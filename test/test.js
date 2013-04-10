(function() {

var pointy = this.pointy || require('../pointy'),
    mocha = this.mocha || require('mocha'),
    assert = this.assert || require('chai').assert;

describe('Scanner', function() {
  describe('#scan', function() {
    it('returns the matched text', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.equal(scanner.scan(/foo/g), 'foo');
    });

    it('returns null when there is no match', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.isNull(scanner.scan(/bar/g));
    });

    it('resumes scanning after the last match', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.equal(scanner.scan(/foo/g), 'foo');
      assert.equal(scanner.scan(/bar/g), 'bar');
      assert.isNull(scanner.scan(/baz/g));
    });
  });

  describe('#scanUntil', function() {
    it('scans ahead to the match and returns all text including the matched text', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.equal(scanner.scanUntil(/bar/g), 'foobar');
    });

    it('returns null when there is no match', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.isNull(scanner.scanUntil(/baz/g));
    });
  });

  describe('#scanTo', function() {
    it('scans ahead to the match and returns all text excluding the matched text', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.equal(scanner.scanTo(/bar/g), 'foo');
    });

    it('returns null when there is no match', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.isNull(scanner.scanTo(/baz/g));
    });
  });

  describe('#check', function() {
    it('returns the matched text at the current position but does not advance the current position', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.equal(scanner.check(/foo/g), 'foo');
      assert.equal(scanner.index, 0);
    });

    it('returns null when there is no match', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.isNull(scanner.scanTo(/baz/g));
    });
  });

  describe('#peek', function() {
    it('returns the next character without advancing the current position', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.equal(scanner.peek(), 'f');
      assert.equal(scanner.index, 0);
    });

    it('accepts a length argument and returns that many characters', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.equal(scanner.peek(3), 'foo');
    });
  });

  describe('#hasTerminated', function() {
    it('knows when it has reached the end of the source', function() {
      var scanner = new pointy.Scanner('foobar');
      assert.isFalse(scanner.hasTerminated());
      assert.equal(scanner.scan(/foo/g), 'foo');
      assert.isFalse(scanner.hasTerminated());
      assert.equal(scanner.scan(/bar/g), 'bar');
      assert.isTrue(scanner.hasTerminated());
    });
  });
});

describe('Parser', function() {
  describe('#parse', function() {
    it('returns one content part for a template with no code', function() {
      parse('foo');
      assertParts(
        'content', 'foo'
      );
    });

    it('returns one expression part for a template containing a single expression', function() {
      parse('@foo');
      assertParts(
        'expression', 'foo'
      );
    });

    it('returns one content part for a template with just an email address it', function() {
      parse('foo@bar.com');
      assertParts(
        'content', 'foo@bar.com'
      );
    });

    it('replaces @@ with @', function() {
      parse('@@foo');
      assertParts(
        'content', '@foo'
      );
    });

    it('returns two parts for a template containing both content and an expression', function() {
      parse('foo @bar');
      assertParts(
        'content',    'foo ',
        'expression', 'bar'
      );
    });

    it('returns three parts for a template containing an expression surrounded by content', function() {
      parse('foo @bar baz');
      assertParts(
        'content',    'foo ',
        'expression', 'bar',
        'content',    ' baz'
      );
    });

    it('returns three parts for a template containing an expression surrounded by markup', function() {
      parse('<foo>@bar</foo>');
      assertParts(
        'content',    '<foo>',
        'expression', 'bar',
        'content',    '</foo>'
      );
    });

    it('doesn\'t allow spaces after @', function() {
      parse('@ foo');
      assertError();
    });

    it('requires { after if', function() {
      parse('@if (foo)');
      assertError(/expected {/);
    });

    it('allows < inside parentheses', function() {
      parse('@if(foo<bar){}');
      assertParts(
        'code', 'if(foo<bar){}'
      );
    });

    it('@if (foo) { <bar>baz</bar> }', function() {
      parse('@if (foo) { <bar>baz</bar> }');
      assertParts(
        'code',    'if (foo) {',
        'content', ' <bar>baz</bar> ',
        'code',    '}'
      );
    });

    it('@if (foo) { <bar>@baz</bar> }', function() {
      parse('@if (foo) { <bar>@baz</bar> }');
      assertParts(
        'code',       'if (foo) {',
        'content',    ' <bar>',
        'expression', 'baz',
        'content',    '</bar> ',
        'code',       '}'
      );
    });

    it('@if (foo) { <bar>@@baz</bar> }', function() {
      parse('@if (foo) { <bar>@@baz</bar> }');
      assertParts(
        'code',       'if (foo) {',
        'content',    ' <bar>@baz</bar> ',
        'code',       '}'
      );
    });

    it('eats some whitespace so that the output is nicely indented', function() {
      parse(
        '<ul>\n' +
        '  @for (var i = 0; i < foos.length; i++) {\n' +
        '    var foo = foos[i];\n' +
        '    <li>@foo</li>\n' +
        '  }\n' +
        '</ul>');
      assertParts(
        'content',    '<ul>\n',
        'code',       'for (var i = 0; i < foos.length; i++) {\n    var foo = foos[i];',
        'content',    '    <li>',
        'expression', 'foo',
        'content',    '</li>\n',
        'code',       '}',
        'content',    '</ul>'
      );
    });

    it('allows < in braces', function() {
      parse('@if (foo) { if (bar < baz) { <quux>lol</quux> } }');
      assertParts(
        'code',    'if (foo) { if (bar < baz) {',
        'content', ' <quux>lol</quux> ',
        'code',    '} }'
      );
    });

    it('supports nested parentheses', function() {
      parse('@if ((foo + bar) / baz) {}');
      assertParts(
        'code', 'if ((foo + bar) / baz) {}'
      );
    });

    it('requires parentheses to be closed', function() {
      parse('@if (foo {}');
      assertError(/expected \)/);
    });

    it('sees an expression and a dot followed by a letter as part of the expression', function() {
      parse('@foo.bar');
      assertParts(
        'expression', 'foo.bar'
      );
    });

    it('sees an expression and a dot followed by a space as content', function() {
      parse('@foo. bar');
      assertParts(
        'expression', 'foo',
        'content',    '. bar'
      );
    });

    it('sees an expression and a dot at the end as content', function() {
      parse('@foo.');
      assertParts(
        'expression', 'foo',
        'content',    '.'
      );
    });

    it('continues expressions followed by parens', function() {
      parse('@foo(bar)');
      assertParts(
        'expression', 'foo(bar)'
      );
    });

    it('continues expressions followed by multiple parens', function() {
      parse('@foo(bar)(baz)');
      assertParts(
        'expression', 'foo(bar)(baz)'
      );
    });

    it('allows nested parens', function() {
      parse('@foo(bar(baz))');
      assertParts(
        'expression', 'foo(bar(baz))'
      );
    });

    it('continues expressions followed by brackets', function() {
      parse('@foo[bar]');
      assertParts(
        'expression', 'foo[bar]'
      );
    });

    it('continues expressions followed by multiple brackets', function() {
      parse('@foo[bar][baz]');
      assertParts(
        'expression', 'foo[bar][baz]'
      );
    });

    it('allows nested brackets', function() {
      parse('@foo[bar[baz]]');
      assertParts(
        'expression', 'foo[bar[baz]]'
      );
    });

    it('allows expressions to be surrounded with parens', function() {
      parse('@(foo + bar)');
      assertParts(
        'expression', 'foo + bar'
      );
    });

    it('allows code to be surrounded with braces', function() {
      parse('@{foo; bar;}');
      assertParts(
        'code', 'foo; bar;'
      );
    });

    it('strips away <text> and </text> around content', function() {
      parse('@if (foo) { <text>bar</text> }');
      assertParts(
        'code',    'if (foo) {',
        'content', ' bar ',
        'code',    '}'
      );
    });

    it('uses @: to start a line of text', function() {
      parse('@if (foo) {\n' +
            '  @:bar\n' +
            '  @:baz\n' +
            '}');
      assertParts(
        'code',    'if (foo) {',
        'content', '  bar\n  baz\n',
        'code',    '}'
      );
    });

    it('uses @* for comments', function() {
      parse('foo@*bar*@baz');
      assertParts(
        'content', 'foo',
        'comment', 'bar',
        'content', 'baz'
      );
    });

    it('allows code inside start tags', function() {
      parse('<foo @if(false){<text>bar="baz"</text>}></foo>');
      assertParts(
        'content', '<foo ',
        'code',    'if(false){',
        'content', 'bar="baz"',
        'code',    '}',
        'content', '></foo>'
      );
    });

    it('allows code inside start tags inside code', function() {
      parse('@if(true){<foo @if(false){<text>bar="baz"</text>}></foo>}');
      assertParts(
        'code',    'if(true){',
        'content', '<foo ',
        'code',    'if(false){',
        'content', 'bar="baz"',
        'code',    '}',
        'content', '></foo>',
        'code',    '}'
      );
    });

    it('knows that if blocks can be followed by else blocks', function() {
      parse('@if (foo) { <bar></bar> } else { <baz></baz> }');
      assertParts(
        'code',    'if (foo) {',
        'content', ' <bar></bar> ',
        'code',    '} else {',
        'content', ' <baz></baz> ',
        'code',    '}'
      );
    });

    it('knows that if blocks can be followed by else if blocks', function() {
      parse('@if (foo) { <foo></foo> } else if (bar) { <bar></bar> } else { <baz></baz> }');
      assertParts(
        'code',    'if (foo) {',
        'content', ' <foo></foo> ',
        'code',    '} else if (bar) {',
        'content', ' <bar></bar> ',
        'code',    '} else {',
        'content', ' <baz></baz> ',
        'code',    '}'
      );
    });

    var template, error;

    function parse(source) {
      template = null;
      error = null;
      var parser = new pointy.Parser();
      try {
        template = parser.parse(source);
      } catch (e) {
        error = e;
      }
    }

    function assertParts() {
      if (error) {
        throw error;
      }
      try {
        for (var i = 0; i < arguments.length; i += 2) {
          var part = i / 2;
          assert.equal(
            template.parts[part].type,
            arguments[i],
            'part[' + part + '].type');
          assert.equal(
            template.parts[part].value,
            arguments[i + 1],
            'part[' + part + '].value');
        }
        assert.equal(template.parts.length, arguments.length / 2);
      } catch (e) {
        logTemplate(template);
        throw e;
      }
    }

    function assertError(re) {
      if (!error) {
        logTemplate(template);
      }
      assert.isNotNull(error, 'expected error message matching ' + re);
      if (re) {
        assert.match(error.message, re);
      }
    }

    function logTemplate(template) {
      if (typeof console !== 'undefined') {
        console.log(template);
      }
    }
  });
});

describe('Compiler', function() {
  describe('#compile', function() {
    it('encodes expression output', function() {
      var parser = new pointy.Parser();
      var template = parser.parse('@foo');
      var fn = template.compile();
      var output = fn({ foo: '<script>bar</script>' });
      assert.equal(output, '&lt;script&gt;bar&lt;/script&gt;');
    });
  });

  it('allows code inside start tags inside code', function() {
    var src = '@if(true){<foo @if(false){<text>bar="baz"</text>}></foo>}';

    var parser = new pointy.Parser();
    var template = parser.parse(src);
    var fn = template.compile();
    var output = fn();

    assert.equal(output, '<foo ></foo>');
  });

  it('supports functions', function() {
    var src = 'before @function foo() { return 42; } @foo() after';

    var output = pointy.render(src);

    assert.equal(output, 'before  42 after');
  });

});

})();
