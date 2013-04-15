Pointy is a template language for embedding JavaScript in HTML.

It was heavily inspired by the Razor template language.

It works with both Node.js and in the browser.

You can run some examples in your browser here:

http://jdiamond.github.io/pointy/examples/examples.html

Installation
============

Use npm or download the source from GitHub.

With Node, just `npm install pointy` and then `require('pointy')` in your
code.

In the browser, just include pointy.js and there will be a global variable
named `pointy` that you can use.

Syntax
======

Expressions are evaluated by prefixing them with the `@` character:

    Hello, @user!

Expressions can be continued with dots, parentheses, or brackets:

    Hello, @user.names[0].toUpperCase()!

Expressions are terminated as soon as a non-identifier character is
encountered (`!` in the previous example).

If you need more control, use parentheses:

    Hello, @(user.name.first + ' ' + user.name.last)!

Expressions that start with `if`, `for`, and `while` are interpreted as
statements and terminated with `}`. Inside the braces, the parser figures out
if a line is code or content automatically:

    @if (user.authenticated) {
        var name = user.name.first;
        <p>Hello, @name!</p>
    }

Use the `<text>` tag to surround plain text:

    @if (user.authenticated) {
        var name = user.name.first;
        <text>Hello, @name!</text>
    }

The `<text>` tag is stripped does not appear in the output.

You can also use `@:` to indicate that the rest of the line is plain text:

    @if (user.isAuthenticated) {
        var name = user.names[0].first;
        @:Hello, @name!
    }

For more control over statements, use braces with your `@` signs:

    @{
        // Any number of JavaScript statements can go here.
    }

See the examples folder for more examples.

API
===

The easiest function to use is `pointy.render(source, data)`. It parses the
template source, compiles it into a function, invokes the function with the
data, and returns the rendered output:

    var html = pointy.render(source, data);

To cache the compiled functions, use the `pointy.compile(source)` function
which takes in the template source and returns a function that accepts the
data and returns the rendered output:

    var fn = pointy.compile(source);
    var output = fn(data);

This is compatible with Express so you can register the `pointy` module as a
template engine:

    app.register('.jshtml', require('pointy'));

Tests
=====

With Node.js:

    npm install --dev
    npm test

In the browser: test/test.html
