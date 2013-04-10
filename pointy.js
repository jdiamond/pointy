(function() {

var pointy = {
    // Quick and dirty.
    render: function(source, data) {
        return this.compile(source)(data);
    },
    // Cache for performance.
    compile: function(source) {
        return this.parse(source).compile();
    },
    // You probably don't need this.
    parse: function(source) {
        var parser = new Parser();
        return parser.parse(source);
    },
    // Public for testability.
    Scanner: Scanner,
    Parser: Parser,
    Template: Template,
    Compiler: Compiler
};

function Scanner(source) {
    this.source = source;
    this.index = 0;
}

Scanner.prototype.consume = function(length) {
    length = length || 1;
    if (this.index < this.source.length) {
        this.index = Math.min(this.index + length, this.source.length);
    }
};

Scanner.prototype.scanChar = function() {
    if (this.index < this.source.length) {
        return this.source.charAt(this.index++);
    }
    return null;
};

Scanner.prototype.scan = function(re, errorMessage, scanAhead, excludeEnd, keepIndex) {
    if (this.index < this.source.length) {
        re.lastIndex = this.index;
        var match = re.exec(this.source);
        if (match && ((match.index === this.index) || scanAhead)) {
            var index = excludeEnd ? match.index : re.lastIndex,
                value = this.source.slice(this.index, index);
            if (!keepIndex) {
                this.index = index;
            }
            return value;
        }
    }
    if (errorMessage) {
        throw new Error(errorMessage);
    }
    return null;
};

Scanner.prototype.scanUntil = function(re, errorMessage) {
    return this.scan(re, errorMessage, true, false);
};

Scanner.prototype.scanTo = function(re, errorMessage) {
    return this.scan(re, errorMessage, true, true);
};

Scanner.prototype.check = function(re, errorMessage) {
    return this.scan(re, errorMessage, false, false, true);
};

Scanner.prototype.peek = function(length) {
    length = length || 1;
    if (this.index < this.source.length) {
        return this.source.substr(this.index, length);
    }
    return null;
};

Scanner.prototype.hasTerminated = function() {
    return this.index >= this.source.length;
};

function Parser() {
}

Parser.prototype.keywords = {
    'if': true,
    'for': true,
    'while': true,
    'function': true
};

Parser.prototype.parse = function(source) {
    var scanner = new Scanner(source);
    var template = new Template();
    this.parseDocument(scanner, template);
    return template;
};

Parser.prototype.parseDocument = function(scanner, template) {
    var content;
    while ((content = this.parseContent(scanner, template, /@/g)) !== null) {
        template.addContent(content);
        this.parseCode(scanner, template);
    }
};

Parser.prototype.parseContent = function(scanner, template, re) {
    var content = '',
        value;
    if (!scanner.hasTerminated()) {
        while ((value = scanner.scanTo(re)) !== null) {
            content += value;
            if (scanner.peek() === '@') {
                var lastChar = value.charAt(value.length - 1),
                    nextChar = scanner.source.charAt(scanner.index + 1);
                if (nextChar === '*') {
                    // it's the start of a comment
                    return content;
                } else if (/\w/.test(lastChar)) {
                    // this might be an email address
                    content += '@';
                    scanner.index += 1;
                } else if (nextChar === '@') {
                    // it's an escaped @
                    content += '@';
                    scanner.index += 2;
                } else {
                    // it starts code
                    return content;
                }
            } else {
                // it must be an end tag
                return content + scanner.scan(re);
            }
        }
        if (!scanner.hasTerminated()) {
            content += scanner.source.slice(scanner.index);
            scanner.index = scanner.source.length;
        }
        return content;
    }
    return null;
};

Parser.prototype.parseCode = function(scanner, template) {
    if (scanner.hasTerminated()) {
        return;
    }
    // eat the @
    scanner.consume();
    if (scanner.peek() === '(') { // @(expression)
        scanner.consume();
        template.addExpression(this.balanceParens(scanner, template, true, true));
        return;
    } else if (scanner.peek() === '{') { // @{code}
        scanner.consume();
        this.balanceBraces(scanner, template, true);
        return;
    } else if (scanner.peek() === '*') { // @*comment*@
        // eat the *
        scanner.consume();
        template.addComment(scanner.scanTo(/\*@/g, 'expected *@'));
        // eat the *@
        scanner.consume(2);
        return;
    }
    this.parseBlockOrExpression(scanner, template);
};

Parser.prototype.parseBlockOrExpression = function(scanner, template) {
    var self = this;
    var identifier = scanner.scan(/\w+/g);
    if (identifier === null) {
        throw new Error('@ cannot be followed by ' + scanner.peek());
    }
    if (this.keywords[identifier]) {
        template.addCode(identifier);
        this.parseKeyword(scanner, template, identifier);
    } else {
        this.parseExpression(scanner, template, identifier);
    }
};

Parser.prototype.parseKeyword = function(scanner, template, keyword) {
    if (keyword === 'if') {
        this.parseIf(scanner, template);
    } else {
        this.parseOuterBlock(scanner, template);
    }
};

Parser.prototype.parseIf = function(scanner, template) {
    var code = scanner.scanTo(/\(/g, 'expected (');
    template.addCode(code);
    this.balanceParens(scanner, template);
    this.parseOuterBlock(scanner, template);
    if ((code = scanner.check(/\s*else/g)) !== null) {
        scanner.consume(code.length);
        code += scanner.scan(/\s+/g);
        template.addCode(code);
        if (scanner.peek() === '{') {
            this.parseOuterBlock(scanner, template);
        } else {
            code = scanner.scan(/if\b/g, 'expected if or {');
            template.addCode(code);
            this.parseIf(scanner, template);
        }
    }
};

Parser.prototype.parseOuterBlock = function(scanner, template) {
    var code = scanner.scanTo(/\{/g, 'expected {');
    template.addCode(code);
    this.parseBlock(scanner, template);
    // eat the following newline (if any)
    scanner.scan(/(\s*\n)?/g);
};

Parser.prototype.parseExpression = function(scanner, template, code) {
    while (true) {
        if (scanner.peek() === '(') {
            code += this.balanceParens(scanner, template, false, true);
        } else if (scanner.peek() === '[') {
            code += this.balanceBrackets(scanner, template, false, true);
        } else if (scanner.peek() === '.') {
            // is it the start of another identifier?
            if (/\w/.test(scanner.source.charAt(scanner.index + 1))) {
                // yep, get the dot and the identifier after it.
                code += scanner.scanChar() + scanner.scan(/\w+/g);
            } else {
                // nope, the dot is content.
                break;
            }
        } else {
            // it's some character that can't continue an expression.
            break;
        }
    }
    template.addExpression(code);
};

Parser.prototype.balanceParens = function(scanner, template, strip, expression) {
    return this.balance(scanner, template, /\(|\)/g, ')', strip, expression);
};

Parser.prototype.balanceBraces = function(scanner, template, strip, expression) {
    return this.balance(scanner, template, /\{|\}/g, '}', strip, expression);
};

Parser.prototype.balanceBrackets = function(scanner, template, strip, expression) {
    return this.balance(scanner, template, /\[|\]/g, ']', strip, expression);
};

Parser.prototype.balance = function(scanner, template, re, close, strip, expression) {
    var code = scanner.scanChar();
    while (true) {
        code += scanner.scanTo(re, 'expected ' + close);
        if (scanner.peek() === close) {
            if (strip) {
                scanner.scanChar();
            } else {
                code += scanner.scanChar();
            }
            if (!expression) {
                template.addCode(code);
            }
            return code;
        } else {
            if (!expression) {
                template.addCode(code);
            }
            code += this.balance(scanner, template, re, close, false, expression);
            if (!expression) {
                code = '';
            }
        }
    }
};

Parser.prototype.parseBlock = function(scanner, template) {
    // add the {
    template.addCode(scanner.scanChar());
    while (true) {
        var next = scanner.scanTo(/\S/g);
        var c = scanner.peek();
        if (c === '}') {
            var lastPart = template.parts[template.parts.length - 1];
            if (lastPart && lastPart.type === 'content') {
                template.addContent(next);
            } else {
                template.addCode(next);
            }
            template.addCode(scanner.scanChar());
            return;
        } else if (c === '<') {
            next = next.replace(/^\s*\n/, '');
            template.addContent(next);
            this.parseTag(scanner, template);
        } else if (scanner.peek(2) === '@:') {
            next = next.replace(/^\s*\n/, '');
            scanner.consume(2);
            template.addContent(next + scanner.scanUntil(/\n/g));
        } else {
            template.addCode(next + scanner.scanTo(/\{|;/g));
            if (scanner.peek() === '{') {
                this.parseBlock(scanner, template);
            } else {
                template.addCode(scanner.scanChar());
            }
        }
    }
};

Parser.prototype.parseTag = function(scanner, template) {
    var self = this;
    var content = scanner.scanChar();
    var tag = scanner.scanTo(/\s|>/g);
    if (tag === 'text') {
        scanner.scanUntil(/>/g, 'expected >');
        content = '';
    } else {
        content += tag;
        go(/@|>/g);
    }
    var re = new RegExp('@|</' + tag + '>', 'gi');
    content += this.parseContent(scanner, template, re);
    go(re);
    if (tag === 'text') {
        content = content.slice(0, -'</text>'.length);
    }
    template.addContent(content);
    function go(re) {
        while (scanner.peek() === '@') {
            template.addContent(content);
            self.parseCode(scanner, template);
            content = self.parseContent(scanner, template, re);
        }
    }
};

function Template() {
    this.parts = [];
}

Template.prototype.addContent = function(content) {
    if (content) {
        var lastPart = this.parts[this.parts.length - 1];
        if (lastPart && lastPart.type === 'content') {
            lastPart.value += content;
        } else {
            this.parts.push({
                type: 'content',
                value: content
            });
        }
    }
};

Template.prototype.addCode = function(code) {
    if (code) {
        this.trimLastContent();
        var lastPart = this.parts[this.parts.length - 1];
        if (lastPart && lastPart.type === 'code') {
            lastPart.value += code;
        } else {
            this.parts.push({
                type: 'code',
                value: code
            });
        }
    }
};

Template.prototype.addExpression = function(expression) {
    if (expression) {
        this.trimLastContent();
        this.parts.push({
            type: 'expression',
            value: expression
        });
    }
};

Template.prototype.addComment = function(comment) {
    if (comment) {
        this.trimLastContent();
        this.parts.push({
            type: 'comment',
            value: comment
        });
    }
};

Template.prototype.trimLastContent = function() {
    var lastPart = this.parts[this.parts.length - 1];
    if (lastPart && lastPart.type === 'content') {
        lastPart.value = lastPart.value.replace(/\n\s+$/, '\n');
    }
};

Template.prototype.compile = function() {
    var compiler = new Compiler();
    return compiler.compile(this);
};

function Compiler() {
}

Compiler.prototype.compile = function(template) {
    var codes = [];
    codes.push('var $output = [];');
    codes.push('with ($data || {}) {');
    for (var i = 0; i < template.parts.length; i++) {
        var part = template.parts[i];
        if (part.type === 'content') {
            codes.push('$output.push("' + encodeString(part.value) + '");');
        } else if (part.type === 'code') {
            codes.push(part.value);
        } else if (part.type === 'expression') {
            codes.push('$output.push($ctx.encodeHTML(' + part.value + '));');
        }
    }
    codes.push('}');
    codes.push('return $output.join("");');
    try {
        var code = codes.join('\n');
        var fn = new Function(['$data', '$ctx'], code);
        var ctx = {
            encodeHTML: encodeHTML
        };
        return function(data) { return fn(data, ctx); };
    } catch(e) {
        console.log('error compiling:');
        console.log(code);
        throw e;
    }
};

function encodeString(str) {
    return str && str.replace(/\\/g, '\\\\')
                     .replace(/\r/g, '\\r')
                     .replace(/\n/g, '\\n')
                     .replace(/\t/g, '\\t')
                     .replace(/\"/g, '\\"');
}

function encodeHTML(str) {
    return str && (str + '').replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;')
                            .replace(/"/g, '&quot;')
                            .replace(/'/g, '&#39;');
}

if (typeof window !== 'undefined') {
    window.pointy = pointy;
}

if (typeof module !== 'undefined') {
    module.exports = pointy;
}

})();
