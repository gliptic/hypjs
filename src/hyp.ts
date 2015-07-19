var Space = ' '.charCodeAt(0);
var Tab = '\t'.charCodeAt(0);
var CR = '\r'.charCodeAt(0);
var LF = '\n'.charCodeAt(0);
var chara = 'a'.charCodeAt(0);
var charz = 'z'.charCodeAt(0);
var charA = 'A'.charCodeAt(0);
var charZ = 'Z'.charCodeAt(0);
var char0 = '0'.charCodeAt(0);
var char9 = '9'.charCodeAt(0);
var charDash = '-'.charCodeAt(0);
var charUnderscore = '_'.charCodeAt(0);
var charDot = '.'.charCodeAt(0);
var charApostrophe = '\''.charCodeAt(0);
var charQuote = '"'.charCodeAt(0);
var charBackslash = '\\'.charCodeAt(0);
var charSlash = '/'.charCodeAt(0);
var charGt = '>'.charCodeAt(0);
var charLt = '<'.charCodeAt(0);
var charEqual = '='.charCodeAt(0);
var isWhitespace = [];
isWhitespace[Space] = true;
isWhitespace[Tab] = true;
isWhitespace[CR] = true;
isWhitespace[LF] = true;

export function assert(condition: any, message?: string) {
    if (!condition) {
        throw message || "Assertion failed";
    }
}

export enum Token {
    Comma = 0,
    Colon,
    Semicolon,
    Dot,
    Bar,
    Underscore,
    Ident,
    OpIdent,
    ConstInt,
    ConstString,
    LBrace,
    RBrace,
    LParen,
    RParen,
    LBracket,
    RBracket,
    Equal,
    Arrow,
    DoubleBackslash,
    Invalid,
    Eof,

    SlashGt,
    Gt,
    Lt,
    LtSlash
}

// Ast
export enum AstKind {
    ConstNum,
    ConstString,
    Name,
    Match,
    App,
    Lambda,
    Record,
    ValRef,
    ParRef,
    ValOfType,
    
    TypeAny,
    TypePrim,
    TypeUnit,
    TypeName,
    TypeApp,
    TypeLambda,
    TypeRecord,
    TypeValOfType,
    TypeNamed
}

export interface Ast {
    kind: AstKind;
    type?: AstType;
}

export interface AstName extends Ast {
    name: string;
}

export interface AstApp extends Ast {
    f: Ast;
    params: FieldPair[];
}

export interface AstConst extends Ast {
    v: number;
}

export interface AstMatch extends Ast {
    pattern: Ast;
    value: Ast;
}

export enum ScanState {
    NotScanned = 0,
    Scanning,
    Scanned
}

export interface Scope {
    valueSymbols: any;
    typeSymbols: any;
    parent: Scope;
}

export interface Case extends Scope {
    p?: FieldPair[];
    f?: FieldPair[];
}

export interface AstLambda extends Ast {
    cases: Case[];
    scanState: ScanState;
}

export interface AstRecord extends Ast {
    f: FieldPair[];
}

export interface AstTypeVal extends Ast {
    typeVal: AstType;
}

export interface AstValRef extends Ast {
    name: string;
    scope: Scope;
    index?: number;
}

export interface FieldPair {
    name: Ast;
    value: Ast;
    type?: AstType; // Only used for parameters
}

function astName(name: string): AstName {
    assert(name);
    return { kind: AstKind.Name, name: name };
}

function astTypeName(name: string): AstType {
    assert(name);
    return { kind: AstKind.TypeName, name: name };
}

function astApp(f: Ast, params: FieldPair[]): AstApp {
    return { kind: AstKind.App, f: f, params: params };
}

function astTypeApp(f: AstType, params: TypeFieldPair[]): AstTypeApp {
    return { kind: AstKind.TypeApp, f: f, params: params };
}

function addParameters(dest: Ast, params: FieldPair[]): Ast {
    if (dest.kind === AstKind.App) {
        var a = <AstApp>dest;
        a.params = a.params.concat(params);
        return a;
    } else {
        return astApp(dest, params);
    }
}


// Types

export interface TypeFieldTypePair {
    name: string;
    type: AstType;
}

export interface TypeFieldPair extends TypeFieldTypePair {
    value?: Ast;
}

export interface AstType {
    kind: AstKind;
}

export interface AstTypeName extends AstType {
    name: string;
}

export interface AstTypeNamed extends AstType {

}

export interface AstTypeLambda extends AstType {
    p: TypeFieldPair[];
    r: AstType;
}

export interface AstTypeRecord extends AstType {
    f: TypeFieldPair[];
}

export interface AstTypeApp extends AstType {
    f: AstType;
    params: TypeFieldPair[];
}

function addTypeParameters(dest: AstType, params: TypeFieldPair[]): AstTypeApp {
    if (dest.kind === AstKind.TypeApp) {
        var a = <AstTypeApp>dest;
        a.params = a.params.concat(params);
        return a;
    } else {
        return { kind: AstKind.TypeApp, f: dest, params: params };
    }
}

var typeAny: AstType = { kind: AstKind.TypeAny },
    typeUnit: AstType = { kind: AstKind.TypeUnit };

function fmap<T>(a: T[], f: (x: T) => T): T[] {
    for (var i = 0, e = a.length; i < e; ++i) {
        var el = a[i];
        a[i] = f(el) || el;
    }
    return a;
}

export function astPostorder(x: Ast, f: (x: Ast) => Ast): Ast {
    switch (x.kind) {
        case AstKind.App: {
            var app = <AstApp>x;
            app.f = astPostorder(app.f, f) || app.f;
            app.params.forEach((v) => {
                v.name = astPostorder(v.name, f) || v.name;
                v.value = astPostorder(v.value, f) || v.value;
            });
        }
        case AstKind.ConstNum:
            break;
    }

    return f(x) || x;
}

export enum TraverseKind {
    Value,
    Pattern,
    Name,
    Type
}

function traverseArray<T>(arr: T[], f: (x: T) => any): any {
    for (var i = 0, e = arr.length; i < e; ++i) {
        var v = f(arr[i]);
        if (v)
            return v;
    }
}

export function traverseValues(x: Ast, f: (x: Ast) => any) {
    switch (x.kind) {
        case AstKind.App: {
            var app = <AstApp>x;
            return f(app.f)
                 || traverseArray(app.params, x => f(x.value));
        }

        case AstKind.Match: {
            var match = <AstMatch>x;

            return f(match.value);
        }

        case AstKind.Lambda: {
            var lambda = <AstLambda>x;

            return traverseArray(lambda.cases, x =>
                       traverseArray(x.p, v => f(v.value))
                    || traverseArray(x.f, v => f(v.value)));
        }

        case AstKind.Record: {
            var record = <AstRecord>x;

            return traverseArray(record.f, x => f(x.value));
        }

        case AstKind.Name:
        case AstKind.ConstNum:
        case AstKind.ConstString:
        case AstKind.ValOfType:
        case AstKind.ValRef:
            return;

        default:
            throw "Unimplemented in traverseValues: " + AstKind[x.kind];
    }
}

export function traversePatterns(x: Ast, f: (x: Ast) => any) {
    switch (x.kind) {
        case AstKind.App: {
            var app = <AstApp>x;
            return f(app.f)
                || traverseArray(app.params, x => f(x.name));
        }

        case AstKind.Match: {
            var match = <AstMatch>x;

            return f(match.pattern);
        }

        case AstKind.Lambda: {
            var lambda = <AstLambda>x;

            return traverseArray(lambda.cases, x =>
                       traverseArray(x.p, v => f(v.name))
                    || traverseArray(x.f, v => f(v.name)));
        }

        case AstKind.Record: {
            var record = <AstRecord>x;

            return traverseArray(record.f, x => f(x.name));
        }

        case AstKind.Name:
        case AstKind.ConstNum:
        case AstKind.ValOfType:
            return;

        default:
            throw "Unimplemented in traversePatterns";
    }
}

export function traverse(x: Ast, kind: TraverseKind, enter: (x: Ast, kind?: TraverseKind) => any, exit?: (x: Ast, kind?: TraverseKind) => any): any {
    if (!x)
        return;
    if (enter(x, kind))
        return true;

    switch (x.kind) {
        case AstKind.App: {
            var app = <AstApp>x;
            if (traverse(app.f, kind, enter, exit))
                return true;

            for (var i = 0, e = app.params.length; i < e; ++i) {
                var v = app.params[i];
                if (traverse(v.name, TraverseKind.Name, enter, exit)
                 || traverse(v.value, kind, enter, exit))
                    return true;
            }
            break;
        }

        case AstKind.Match: {
            var match = <AstMatch>x;

            if (traverse(match.pattern, TraverseKind.Pattern, enter, exit)
             || traverse(match.value, kind, enter, exit))
                return true;
            break;
        }

        case AstKind.Lambda: {
            var lambda = <AstLambda>x;

            for (var ic = 0, ec = lambda.cases.length; ic < ec; ++ic) {
                var c = lambda.cases[i];

                for (var i = 0, e = c.p.length; i < e; ++i) {
                    var v = c.p[i];
                    if (traverse(v.name, TraverseKind.Name, enter, exit)
                     || traverse(v.value, kind, enter, exit))
                        return true;
                }

                for (var i = 0, e = c.f.length; i < e; ++i) {
                    var v = c.f[i];
                    if (traverse(v.name, TraverseKind.Name, enter, exit)
                     || traverse(v.value, kind, enter, exit))
                        return true;
                }
            }
            
            break;
        }

        case AstKind.Record: {
            var record = <AstRecord>x;

            for (var i = 0, e = record.f.length; i < e; ++i) {
                var v = record.f[i];
                if (traverse(v.name, TraverseKind.Name, enter, exit)
                 || traverse(v.value, kind, enter, exit))
                    return true;
            }
        }
    }

    return exit && exit(x, kind);
}

interface Context {

}

export interface Module extends AstLambda {
    name: string;
}

export function AstParser(source: string) {
    var sourcePos: number;
    var sourceLen: number;
    var precedence: number[];
    var c: number;
    var tokenBeg: number;
    var beginLine: number;
    var curIndent: number;
    var firstOnLine: boolean;
    var prevIndent: number;
    var prevArrowIndent: number;
    var indents: number[];
    var currentLine: number;
    var tokenData: any;
    var tokenPrec: number;
    var tt: Token;
    var currentScope: Scope;
        
    source = source;
    sourcePos = 0;
    sourceLen = source.length;
    precedence = [];
    currentLine = 0;
    precedence['='.charCodeAt(0)] = 1;
    precedence['&'.charCodeAt(0)] = 1;
    precedence['<'.charCodeAt(0)] = 2;
    precedence['>'.charCodeAt(0)] = 2;
    precedence['+'.charCodeAt(0)] = 3;
    precedence['-'.charCodeAt(0)] = 3;
    precedence['*'.charCodeAt(0)] = 4;
    precedence['/'.charCodeAt(0)] = 4;
    precedence['\\'.charCodeAt(0)] = 4;
    beginLine = 0;
    prevArrowIndent = -1;
    firstOnLine = true;
    nextch();
    skipWs();
    indents = [];
    tokenBeg = sourcePos - 1;
    prevIndent = -1;
    curIndent = beginCol();
    
    function beginCol() {
        return tokenBeg - beginLine;
    }

    // TODO: This can be called even if no error will ultimately result
    function unexpectedChar() {
        console.log("Unexpected character", String.fromCharCode(c));
        tt = Token.Invalid;
    }

    function nextch() {
        c = sourcePos >= sourceLen ? 0 : source.charCodeAt(sourcePos);
        ++sourcePos;
    }

    function nextMarkup(): any {
        var data = tokenData;
        tokenBeg = sourcePos - 1;

        if ((c >= chara && c <= charz)
         || (c >= charA && c <= charZ)
         ||  c === charDash || c === charUnderscore) {
            var ident = '';
            while ((c >= chara && c <= charz)
                || (c >= charA && c <= charZ)
                ||  c === charDash || c === charUnderscore) {
                ident += String.fromCharCode(c);
                nextch();
            }

            tokenData = ident;
            tt = Token.Ident;
        } else if (c === charDot) {
            nextch();
            tt = Token.Dot;
        } else if (c === charSlash) {
            nextch();
            if (c === charGt) {
                nextch();
                tt = Token.SlashGt;
            } else {
                unexpectedChar();
            }
        } else if (c === charGt) {
            nextch();
            tt = Token.Gt;
        } else if (c === charLt) {
            nextch();
            if (c === charSlash) {
                nextch();
                tt = Token.LtSlash;
            } else {
                tt = Token.Lt;
            }
        } else if (c === charEqual) {
            nextch();
            tt = Token.Equal;
        }

        skipWs();
        return data;
    }

    function skipWs() {
        var newline = false;
        while (isWhitespace[c]) {
            if (c === CR || c === LF) {
                beginLine = sourcePos;
                newline = true;
            }
            nextch();
        }

        if (newline) {
            firstOnLine = true;
            curIndent = sourcePos - 1 - beginLine;
        }
    }

    function next() {
        var data = tokenData;
        tokenBeg = sourcePos - 1;

        if (firstOnLine && c !== 0) {
            firstOnLine = false;
            var bc = beginCol();
            if (bc <= prevArrowIndent) {
                tt = Token.Semicolon;
                return data;
            } else if (bc <= prevIndent) {
                tt = Token.Comma;
                return data;
            }
        }

        if ((c >= chara && c <= charz)
         || (c >= charA && c <= charZ)
         ||  c === charDot) {
            var ident = '';
            do {
                ident += String.fromCharCode(c);
                nextch();
            } while ((c >= chara && c <= charz)
                  || (c >= charA && c <= charZ)
                  || (c >= char0 && c <= char9));

            tokenData = ident;
            tt = Token.Ident;
        } else if (c >= char0 && c <= char9) {
            var text = '';
            while ((c >= char0 && c <= char9)) {
                text += String.fromCharCode(c);
                nextch();
            }

            tokenData = +text;
            tt = Token.ConstInt;
        } else if (c === 0) {
            tt = Token.Eof;
        } else {
            var cnum = c;
            var cstr = String.fromCharCode(cnum);
            nextch();
            switch (cnum) {
                case '{'.charCodeAt(0): tt = Token.LBrace; break;
                case '}'.charCodeAt(0): tt = Token.RBrace; break;
                case '('.charCodeAt(0): tt = Token.LParen; break;
                case ')'.charCodeAt(0): tt = Token.RParen; break;
                case '['.charCodeAt(0): tt = Token.LBracket; break;
                case ']'.charCodeAt(0): tt = Token.RBracket; break;
                case ':'.charCodeAt(0): tt = Token.Colon; break;
                case ';'.charCodeAt(0): tt = Token.Semicolon; break;
                case ','.charCodeAt(0): tt = Token.Comma; break;
                case '.'.charCodeAt(0): tt = Token.Dot; break;
                case '|'.charCodeAt(0): tt = Token.Bar; break;
                case '\''.charCodeAt(0):
                    var ident = '';
                    while (c != charApostrophe && c) {
                        ident += String.fromCharCode(c);
                        nextch();
                    }
                    nextch();
                    tokenData = ident;
                    tt = Token.Ident;
                    break;
                case '"'.charCodeAt(0):
                    var ident = '';
                    while (c != charQuote && c) { // TODO: Escape seqs
                        ident += String.fromCharCode(c);
                        nextch();
                    }
                    if (c !== charQuote)
                        throw "Expected end quote";
                    nextch();
                    tokenData = ident;
                    tt = Token.ConstString;
                    break;
                case '_'.charCodeAt(0): tt = Token.Underscore; break;
                default:
                    var prec = precedence[cnum];
                    if (prec) {
                        var ident = cstr;
                        while (precedence[c]) {
                            ident += String.fromCharCode(c);
                            nextch();
                        }

                        if (ident === '=') {
                            tt = Token.Equal;
                        } else if (ident === '->') {
                            tt = Token.Arrow;
                        } else if (ident === '\\\\') {
                            tt = Token.DoubleBackslash;
                        } else {
                            tokenData = ident;
                            tokenPrec = prec;
                            tt = Token.OpIdent;
                        }
                    } else {
                        unexpectedChar();
                    }
                    break;
            }
        }

        skipWs();
        return data;
    }

    function expect(t: Token): any {
        if (tt !== t) {
            throw 'Parse error. Expected ' + Token[t] + ', got ' + Token[tt];
        }
        return next();
    }

    function expectPeek(t: Token) {
        if (tt !== t) {
            throw 'Parse error. Expected ' + Token[t] + ', got ' + Token[tt];
        }
    }

    function expectMarkup(t: Token): any {
        if (tt !== t) {
            throw 'Parse error. Expected ' + Token[t] + ', got ' + Token[tt];
        }
        return nextMarkup();
    }

    function test(t: Token): boolean {
        return tt === t ? (next(), true) : false;
    }

    function testMarkup(t: Token): boolean {
        return tt === t ? (nextMarkup(), true) : false;
    }

    // Type space

    // Needs next() after
    function typePrimaryExpressionDelimited(): AstType {
        var ret: AstType;
        switch (tt) {
            case Token.Ident:
                ret = { kind: AstKind.TypeName, name: <string>tokenData };
                break;

            case Token.LBrace:
                ret = typeLambdaDelimited();
                break;

            case Token.LBracket:
                ret = typeRecordDelimited(Token.LBracket, Token.RBracket);
                break;

            case Token.LParen:
                next();
                ret = typeExpression();
                expectPeek(Token.RParen);
                break;

            case Token.OpIdent:
                var op = next();
                var rest = typePrimaryExpressionDelimited();
                return astTypeApp(astTypeName(op), [{ name: null, type: rest }]);

            default:
                throw "Unexpected token " + Token[tt] + " in primary type expression";
        }

        return ret;
    }

    function typePrimaryExpressionTail(ret: AstType): AstType {
        next();
        while (true) {
            switch (tt) {
                case Token.LParen:
                    var r = typeRecordDelimited(Token.LParen, Token.RParen);
                    next();
                    ret = addTypeParameters(ret, r.f);
                    break;

                case Token.LBracket:
                case Token.LBrace:
                case Token.Ident:
                    var e = typePrimaryExpressionDelimited();
                    next();
                    ret = addTypeParameters(ret, [{ name: null, type: e, value: null }]);
                    break;

                default:
                    return ret;
            }
        }
    }

    function typeExpression(): AstType {
        var p = typePrimaryExpressionDelimited();
        p = typePrimaryExpressionTail(p);

        return p;
    }

    function typeExpressionOrBinding(): TypeFieldPair {
        var a = typeExpression();

        if (tt === Token.Colon || tt === Token.Equal) {
            if (a.kind !== AstKind.TypeName) {
                throw "Type binding must be a name";
            }

            var name = (<AstTypeName>a).name;

            var t = typeAny, e: Ast = null;

            if (test(Token.Colon)) {
                t = typeExpression();
            }

            if (test(Token.Equal)) {
                e = ruleExpression();
            }

            return { name: name, type: t, value: e };
        } else {
            return { name: null, type: a, value: null };
        }
    }

    function typePair(t: AstType): TypeFieldTypePair {
        // TODO
        return null;
    }

    function typeRecordBody(): AstTypeRecord {
        var fields: TypeFieldPair[] = [];

        var oldPrevIndent = prevIndent;
        var oldPrevArrowIndent = prevArrowIndent;
        prevIndent = curIndent;
        prevArrowIndent = -1; // Do not insert ;

        while (true) {
            while (tt === Token.Comma) {
                next();
            }

            if (tt === Token.RBrace || tt === Token.RParen || tt === Token.RBracket || tt === Token.Eof) {
                break;
            }

            var e = typeExpressionOrBinding();

            fields.push(e);

            if (tt !== Token.Comma) {
                break;
            }
        }

        prevIndent = oldPrevIndent;
        prevArrowIndent = oldPrevArrowIndent;
        
        return { kind: AstKind.TypeRecord, f: fields };
    }

    function typeLambdaBody(): { p: TypeFieldPair[]; r: AstType } {
        var params: TypeFieldPair[] = [], fields: TypeFieldPair[] = [];
        var seenParams = false;

        var oldPrevIndent = prevIndent;
        var oldPrevArrowIndent = prevArrowIndent;
        prevIndent = curIndent;
        prevArrowIndent = -1; // Do not insert ;

        while (true) {
            while (tt === Token.Comma) {
                next();
            }

            if (tt === Token.RBrace || tt === Token.RParen || tt === Token.RBracket || tt === Token.Eof) {
                break;
            }

            var e = typeExpressionOrBinding();

            fields.push(e);

            if (tt === Token.Arrow) {
                prevIndent = curIndent;
                next();

                if (seenParams) {
                    throw "Only one parameter block allowed in a function type";
                }
                seenParams = true;
                params = fields;
                fields = [];
            } else if (tt !== Token.Comma && tt !== Token.Semicolon) {
                break;
            }
        }

        prevIndent = oldPrevIndent;
        prevArrowIndent = oldPrevArrowIndent;

        console.log("fields.length", fields.length);

        var rtype;
        if (fields.length > 1) {
            throw "Only one type allowed in return type of function type";
        } else if (fields.length < 1) {
            rtype = typeUnit;
        } else {
            rtype = fields[0];
        }

        return { p: params, r: rtype };
    }

    // Needs next() after
    function typeLambdaDelimited() {
        expect(Token.LBrace);
        var r = <AstTypeLambda>typeLambdaBody();
        expectPeek(Token.RBrace);
        r.kind = AstKind.TypeLambda;
        return r;
    }

    // Needs next() after
    function typeRecordDelimited(l: Token, r: Token): AstTypeRecord {
        expect(l);
        var b = typeRecordBody();
        expectPeek(r);
        return b;
    }

    function rulePrimaryMarkupDelimited(): Ast {
        nextMarkup();
        var tagName: string;
        if (tt === Token.Ident) {
            tagName = <string>nextMarkup();
        }

        var classes = '';
        var classMode = false;

        while (true) {
            if (tt === Token.Dot) {
                nextMarkup();
                if (tt !== Token.Ident)
                    throw 'Expected class name';
                classes += ' ' + nextMarkup();
                classMode = true;
            } else {
                break;
            }
        }

        var args: FieldPair[] = [];

        if (classes) {
            args.push({ name: astName('class'), value: <Ast>{ kind: AstKind.ConstString, value: classes } });
        }

        while (tt === Token.Ident) {
            var attrName = <string>nextMarkup();
            expectPeek(Token.Equal);
            next();
            var attrValue = rulePrimaryExpressionDelimited();
            nextMarkup();
            args.push({ name: astName(attrName), value: attrValue });
        }

        // <a b=c />  ->  a(b = c)

        if (tt === Token.SlashGt) {
            /* Nothing to do */
        } else if (test(Token.Gt)) { // We use normal lexer here because it can handle <, </ and primary expressions
            var children: FieldPair[] = [];
            while (true) {
                while (test(Token.Comma)) /* Nothing */;

                var child;
                if (tt === Token.OpIdent && tokenData === '<') {
                    child = rulePrimaryMarkupDelimited();
                    next();
                } else if (tt === Token.OpIdent && tokenData === '</') {
                    nextMarkup();
                    var endTagName = expectMarkup(Token.Ident);
                    if (tagName !== endTagName) {
                        throw "Mismatch in end tag. Expected " + tagName + ", got " + endTagName;
                    }
                    expectPeek(Token.Gt); // Delimited
                    break;
                } else {
                    child = rulePrimaryExpressionDelimited();
                    next();
                }

                children.push({
                    name: null, value: child
                });
            }
            args.push({ name: astName('children'), value: { kind: AstKind.Record, f: children } });
        } else {
            throw "Expected end of tag";
        }

        return astApp(astName(tagName), args);
    }

    // Value space
    // Needs next() after
    function rulePrimaryExpressionDelimited(): Ast {
        switch (tt) {
            case Token.ConstInt:    return { kind: AstKind.ConstNum, value: <number>tokenData };
            case Token.ConstString: return { kind: AstKind.ConstString, value: <string>tokenData };
            case Token.Ident:       return { kind: AstKind.Name, name: <string>tokenData };
            case Token.Colon:
                next();
                var t = typePrimaryExpressionDelimited();
                return { kind: AstKind.ValOfType, typeVal: t };
            case Token.LParen:
                next();
                var ret = ruleExpression();
                expectPeek(Token.RParen);
                return ret;
            case Token.LBrace:
                return ruleLambdaDelimited();
            case Token.LBracket:
                return ruleRecordDelimited(Token.LBracket, Token.RBracket);
            case Token.OpIdent:
                if (tokenData === '<') {
                    return rulePrimaryMarkupDelimited();
                } else {
                    var op = next();
                    var rest = rulePrimaryExpressionDelimited();
                    return astApp(astName(op), [{ name: null, value: rest }]);
                }
            default:
                throw "Unexpected token " + Token[tt] + " in primary expression";
        }
    }

    // Needs next() after
    function ruleRecordDelimited(l: Token, r: Token): AstRecord {
        expect(l);
        var b = ruleRecordBody();
        expectPeek(r);
        return b;
    }

    function rulePrimaryExpressionTail(ret: Ast): Ast {
        next();
        while (true) {
            switch (tt) {
                case Token.LParen:
                    var r = ruleRecordDelimited(Token.LParen, Token.RParen);
                    next();
                    ret = addParameters(ret, r.f);
                    break;

                case Token.Ident:
                    var name = next();
                    ret = astApp(astName(name), [{ name: null, value: ret }]);
                    break;

                case Token.LBracket:
                case Token.LBrace:
                    var e = rulePrimaryExpressionDelimited();
                    next();
                    ret = addParameters(ret, [{ name: null, value: e }]);
                    break;

                default:
                    return ret;
            }
        }
    }

    function ruleExpressionRest(lhs: Ast, minPred: number): Ast {
        while (tt === Token.OpIdent) {
            var pred = tokenPrec;
            if (pred < minPred) break;

            var op = next();
            var rhs = rulePrimaryExpressionDelimited();
            rhs = rulePrimaryExpressionTail(rhs);

            while (tt === Token.OpIdent) {
                var pred2 = tokenPrec;
                if (pred2 < pred) break;
                rhs = ruleExpressionRest(rhs, pred2);
            }

            lhs = astApp(astName(op), [{ name: null, value: rhs }, { name: null, value: lhs }]);
        }

        if (test(Token.Colon)) {
            lhs.type = typeExpression();
        }

        return lhs;
    }

    function ruleExpression(): Ast {
        var p = rulePrimaryExpressionDelimited();
        p = rulePrimaryExpressionTail(p);
        var e = ruleExpressionRest(p, 0);

        if (test(Token.Equal)) {
            var pv = rulePrimaryExpressionDelimited();
            pv = rulePrimaryExpressionTail(pv);
            var ev = ruleExpressionRest(pv, 0);

            e = { kind: AstKind.Match, pattern: e, value: ev };
        }
        
        return e;
    }

    function ruleExpressionOrBinding(): FieldPair {
        if (test(Token.Colon)) {
            var a = typeExpression();

            if (test(Token.Equal)) {
                var t;

                if (a.kind !== AstKind.TypeName) { // TODO: Support parameters
                    throw "Type binding must be a name";
                }

                var name = (<AstTypeName>a).name;

                if (tt === Token.Bar) {
                    var v = [];

                    while (test(Token.Bar)) {
                        var ty = typeExpression();

                        if (ty.kind !== AstKind.TypeApp && ty.kind !== AstKind.TypeName) {
                            throw "Expected variant";
                        }

                        v.push(ty);
                    }
                } else {
                    t = typeExpression();
                }

                return { name: astName(name), value: { kind: AstKind.ValOfType, typeVal: t } };
            } else {
                return { name: null, value: { kind: AstKind.ValOfType, typeVal: t } };
            }
        }

        var e = <AstMatch>ruleExpression();
        if (e.kind === AstKind.Match) {
            return { name: e.pattern, value: e.value, type: e.pattern.type };
        /*
        } else if (e.type && e.kind === AstKind.Name) { // TODO: Handle other patterns than names
            var type = e.type;
            e.type = null; // Don't leave traces in pattern
            return { name: e, value: e.value, type: e.type };
            */
        } else {
            return { name: null, value: e, type: e.type };
        }
    }

    function ruleLambdaDelimited(): Ast {
        expect(Token.LBrace);
        var r = ruleLambdaBody();
        expectPeek(Token.RBrace);
        r.scanState = ScanState.NotScanned;
        return r;
    }

    function ruleRecordBody(): AstRecord {
        var fields: FieldPair[] = [];

        var oldPrevIndent = prevIndent;
        var oldPrevArrowIndent = prevArrowIndent;
        prevIndent = curIndent;
        prevArrowIndent = -1; // Do not insert ;

        while (true) {
            while (tt === Token.Comma) {
                next();
            }

            if (tt === Token.RBrace || tt === Token.RParen || tt === Token.RBracket || tt === Token.Eof) {
                break;
            }

            var e = ruleExpressionOrBinding();

            fields.push(e);

            if (tt !== Token.Comma) {
                break;
            }
        }

        prevIndent = oldPrevIndent;
        prevArrowIndent = oldPrevArrowIndent;

        return { kind: AstKind.Record, f: fields };
    }

    function ruleLambdaBody(): AstLambda {
        var params: FieldPair[] = [], fields: FieldPair[] = [];
        var seenParams = false;

        var cases: Case[] = [];

        var oldPrevIndent = prevIndent;
        var oldPrevArrowIndent = prevArrowIndent;
        var oldCurIndent = curIndent;
        prevIndent = oldCurIndent;
        prevArrowIndent = oldPrevIndent;

        var parentScope = currentScope;

        var cas: Case = { valueSymbols: {}, typeSymbols: {}, parent: parentScope };
        var lambda = { kind: AstKind.Lambda, cases: cases, scanState: ScanState.NotScanned };

        currentScope = cas;

        function flushCase() {
            if (fields.length > 0 || params.length > 0) {
                cas.p = params;
                cas.f = fields;
                cases.push(cas);
                fields = [];
                params = [];

                cas = { valueSymbols: {}, typeSymbols: {}, parent: parentScope };
                currentScope = cas;
            }
        }

        while (true) {
            while (tt === Token.Semicolon || tt === Token.Comma) {
                if (tt === Token.Semicolon) {
                    if (seenParams) {
                        // Reverse '->' changes
                        prevIndent = prevArrowIndent;
                        prevArrowIndent = oldPrevIndent;
                        
                        seenParams = false;
                    }

                    flushCase();
                }

                next();
            }

            if (tt === Token.RBrace || tt === Token.RParen || tt === Token.RBracket || tt === Token.Eof) {
                break;
            }

            var e = ruleExpressionOrBinding();

            fields.push(e);

            if (test(Token.DoubleBackslash)) {
                // TODO: Convert to a post-processing step
                var name = e.name;
                e.name = null;

                flushCase();
                cases = [];
                var newLambda = { kind: AstKind.Lambda, cases: cases, scanState: ScanState.NotScanned };

                e.value = addParameters(e.value, [{ name: name, value: newLambda }]);

                seenParams = true;
                params.push({ name: name, value: null });
            } else if (tt === Token.Arrow) {
                prevArrowIndent = prevIndent;
                prevIndent = curIndent;

                next();

                if (seenParams) {
                    throw "Additional parameter blocks must be preceded by ';'";
                }
                seenParams = true;
                params = fields.map(x => {
                    if (x.name && x.name.kind === AstKind.Name) {
                        console.log('x.name.type = ', x.name.type);
                        return { name: x.name, value: x.value, type: x.name.type };
                    }
                    if (x.value && x.value.kind === AstKind.Name) {
                        return { name: x.value, value: null, type: x.value.type || x.name.type }; // TODO: Handle when types exist on both
                    }
                    throw "Expected name";
                });
                fields.length = 0;
            } else if (tt !== Token.Comma && tt !== Token.Semicolon) {
                break;
            }
        }

        flushCase();
        
        prevIndent = oldPrevIndent;
        prevArrowIndent = oldPrevArrowIndent;
        
        return lambda;
    }

    function ruleModule(): Module {
        currentScope = {
            parent: null,

            typeSymbols: {
                i32: { kind: AstKind.TypePrim, float: false, bits: 32, signed: true },
                f64: { kind: AstKind.TypePrim, float: true, bits: 64, signed: true },
                '&': { kind: AstKind.TypeLambda },
            },
            valueSymbols: {
                '&': { kind: AstKind.Lambda },
                'if': { kind: AstKind.Lambda },
                'else': { kind: AstKind.Lambda },
                '<': { kind: AstKind.Lambda },
                '+': { kind: AstKind.Lambda },
                '-': { kind: AstKind.Lambda },
            }
        };

        var r = ruleLambdaBody();
        console.log(r);
        expect(Token.Eof);
        var m = <Module>r;
        m.name = "";
        return m;
    }

    next();

    return {
        ruleModule: ruleModule
    };
}

export class Compiler {
    mods: Module[];
    scanContext: Case;
    strings: string[];
    baseLocalIndex: number;
    currentLocalIndex: number;

    constructor() {
        this.mods = [];
        this.strings = [];
        this.currentLocalIndex = 0;
    }

    // TODO: Intern types to avoid extra work in codegen

    resolveType(t: AstType): AstType {
        if (!t) return t;

        switch (t.kind) {
            case AstKind.TypeApp: {
                var app = <AstTypeApp>t;
                //if (app.f.kind === AstTypeKind.Name && (<any>app.f).name === "type") {
                if (app.f.kind === AstKind.TypeName) {
                    // TODO: Only allow one parameter
                    var tv = app.params[0];
                    // TODO: tv.name must be null here
                    tv.type = this.resolveType(tv.type);
                }
                return t;
            }

            case AstKind.TypeRecord: {
                var record = <AstTypeRecord>t;
                record.f.forEach(a => a.type = this.resolveType(a.type));
                return t;
            }

            case AstKind.TypeLambda: {
                var lambda = <AstTypeLambda>t;
                lambda.p.forEach(a => a.type = this.resolveType(a.type));
                this.resolveType(lambda.r);
                return t;
            }

            case AstKind.TypeName: {
                var name = <AstTypeName>t;
                var sym = this.findTypeSymbol(name.name);
                if (sym) {
                    // TODO: Check that sym is a type
                    console.log("Found type symbol", name.name);
                    return sym;
                } else {
                    return name;
                }
            }

            default:
                return t;
        }
    }

    resolvePattern(p: Ast) {
        switch (p.kind) {
            case AstKind.Name: {
                p.type = this.resolveType(p.type);
                break;
            }

            default:
                throw "Unimplemented: complex patterns";
        }
    }

    addValueSymbol(name: string, sym: AstValRef) {
        if (this.scanContext.valueSymbols[name]) {
            throw "Identifier already used " + name;
        }
        console.log("Adding value", name);
        this.scanContext.valueSymbols[name] = sym;
    }

    addTypeSymbol(name: string, sym: any) {
        if (this.scanContext.typeSymbols[name]) {
            throw "Identifier already used " + name;
        }
        console.log("Adding type", name);
        this.scanContext.typeSymbols[name] = sym;
    }

    findValueSymbol(name: string): any {
        function find(name: string, sc: Case) {
            var val = sc.valueSymbols[name];
            if (val) return val;
            if (!sc.parent) {
                return null;
            }
            return find(name, sc.parent);
        }
        
        return find(name, this.scanContext);
    }

    findTypeSymbol(name: string): any {
        function find(name: string, sc: Case) {
            var val = sc.typeSymbols[name];
            if (val) return val;
            if (!sc.parent) {
                return null;
            }
            return find(name, sc.parent);
        }

        return find(name, this.scanContext);
    }

    resolveMatch(name: Ast, value: Ast) {
        if (name) {
            this.resolvePattern(name);
            if (name.kind === AstKind.Name) {
                var n = <AstName>name;
                this.addValueSymbol(n.name, { kind: AstKind.ValRef, name: n.name, scope: this.scanContext });
                // TODO: Handle other patterns
            } else {
                throw "Unimplemented: patterns";
            }
        }
        
        this.scan(value, null);
        // value.type
    }

    matchTypes(a: AstType, b: AstType): AstType {
        if (!a) return b;
        if (!b) return a;

        if (a === b) {
            return a;
        }

        if (a.kind === b.kind) {
            switch (a.kind) {
                case AstKind.TypeRecord: {
                    var af = (<AstTypeRecord>a).f;
                    var bf = (<AstTypeRecord>b).f;

                    if (af.length !== bf.length) {
                        throw "Types have different number of fields";
                    }

                    for (var i = 0, e = af.length; i < e; ++i) {
                        var afe = af[i];
                        var bfe = bf[i];
                        if (afe.name !== bfe.name) {
                            throw "Names in record do not match. " + afe.name + " != " + bfe.name;
                        } else if (!this.matchTypes(afe.type, bfe.type)) {
                            throw "Type for field " + afe.name + " does not match";
                        }
                    }

                    return a;
                }

                case AstKind.TypeLambda: {
                    var al = (<AstTypeLambda>a);
                    var bl = (<AstTypeLambda>b);

                    if (al.p.length !== bl.p.length) {
                        throw "Function types have different number of parameters";
                    }

                    if (!this.matchTypes(al.r, bl.r)) {
                        throw "Return type of function types do not match";
                    }

                    for (var i = 0, e = al.p.length; i < e; ++i) {
                        var alp = al.p[i];
                        var blp = bl.p[i];
                        // TODO: Match names and default values as well?
                        if (!this.matchTypes(alp.type, blp.type)) {
                            throw "Parameter types of function types do not match";
                        }
                    }
                }
            }

            throw "Types do not match";
        }
    }

    unifyTypes(a: AstType, b: AstType) {
        var common = this.matchTypes(a, b);
        if (common)
            return common;

        // TODO: Find common subtype

        throw "Types must be the same kind";
    }

    unifyTypeArrayInto(a: AstType[], b: AstType[]) {
        if (!a) return b;
        if (!b) return a;

        if (a.length !== b.length) {
            throw "Type lists have different number of types";
        }

        for (var i = 0, e = a.length; i < e; ++i) {
            a[i] = this.unifyTypes(a[i], b[i]);
        }
    }

    build(m: Ast): string {
        this.scan(m, null);

        return this.generate(m);
    }

    localByIndex(index: number): string {
        var s = '';

        for (;;) {
            var digit = index % 52;
            if (index === 0 && s.length > 0)
                break;
            s += String.fromCharCode(digit > 26 ? digit - 26 + 65 : digit + 97);
            index = (index / 52) | 0;
        }

        return s;
    }

    write(s: string) {
        this.strings.push(s);
    }

    generate(m: Ast): string {
        this.gen(m);
        return this.strings.join('');
    }

    gen(m: Ast) {
        switch (m.kind) {
            case AstKind.App: {
                var app = <AstApp>m;
                // TODO: Depending on the type (and value) of app.f, perform function call or use operator

                this.write('(');
                this.gen(app.f);
                this.write(')');

                this.write('(');
                var first = true;
                app.params.forEach(p => {
                    // TODO: Match named parameters (This should maybe be done in the resolve phase)
                    if (!first) {
                        this.write(', ');
                    }
                    first = false;
                    this.gen(p.value);
                });
                this.write(')');
                break;
            }

            case AstKind.ConstNum: {
                var num = <AstConst>m;
                this.write(num.v.toString());
                break;
            }

            case AstKind.ValRef:
            case AstKind.ParRef: {
                var ref = <AstValRef>m;
                this.write(ref.name);
                break;
            }

            case AstKind.Record: {
                
                break;
            }

            case AstKind.Lambda: {
                var lambda = <AstLambda>m;

                var oldScanContext = this.scanContext;

                var tempNames = {};

                lambda.cases.forEach(c => {
                    //var caseTempCount = c.f.length + c.p.length;
                    //tempCount = Math.max(tempCount, caseTempCount);

                    function addName(f) {
                        if (f.name) // TODO: Other patterns
                            tempNames[f.name.name] = true;
                    }

                    //c.p.forEach(addName);
                    c.f.forEach(addName);
                });

                //var oldBaseLocalIndex = this.baseLocalIndex;
                //this.baseLocalIndex = this.currentLocalIndex;
                //this.currentLocalIndex += tempCount;

                this.write('function(');

                this.write(lambda.cases[0].p.map(p => {
                    // TODO: Other patterns
                    return (<any>p.name).name;
                }).join(', '));
                this.write(') {');

                var keys = Object.keys(tempNames);
                if (keys.length > 0) {
                    this.write('var ');
                    this.write(keys.join(', '));
                    this.write(';');
                }

                // Enter bodies
                lambda.cases.forEach(c => {
                    this.scanContext = c;

                    c.f.forEach(f => {
                        if (f.name) {
                            // TODO: Other patterns
                            this.write((<any>f.name).name);
                            this.write(' = ');
                        }
                        if (f.value)
                            this.gen(f.value);
                    })
                });

                this.write('}');

                //this.currentLocalIndex -= tempCount;
                //this.baseLocalIndex = oldBaseLocalIndex;

                this.scanContext = oldScanContext;
            }
        }
    }

    scan(m: Ast, contextType: AstType) {
        if (!m) return;

        switch (m.kind) {
            case AstKind.ValOfType: {
                var typeVal = <AstTypeVal>m;
                typeVal.type = { kind: AstKind.TypeValOfType };
                typeVal.typeVal = this.resolveType(typeVal.typeVal);
                break;
            }

            case AstKind.App: {
                var app = <AstApp>m;
                this.scan(app.f, null);
                app.params.forEach(a => this.scan(a.value, null));
                break;
            }

            case AstKind.Record: {
                var record = <AstRecord>m;
                record.f.forEach(a => this.scan(a.value, null));
                break;
            }

            case AstKind.Lambda: {
                var lambda = <AstLambda>m;
                var pendingAdding: FieldPair[] = [];

                var flushPending = () => {
                    // TODO
                    pendingAdding.forEach(p => {
                        var n = <AstName>p.name;
                        //console.log("Resolving pending node", n.name);
                        this.scan(p.value, p.name.type);
                    });

                    pendingAdding.length = 0;
                }

                if (lambda.scanState === ScanState.NotScanned) {
                    lambda.scanState = ScanState.Scanning;

                    var oldScanContext = this.scanContext;
                    
                    var ptypes: AstType[];
                    var ftype: AstType;

                    lambda.cases.forEach(c => {
                        var casePtypes = [];

                        this.scanContext = c;

                        var index = 0;

                        // TODO: Use context type to fill in parameter types
                        c.p.forEach(p => {
                            if (p.name.kind === AstKind.Name) {
                                this.scan(p.value, p.type);

                                var n = <AstName>p.name;
                                this.addValueSymbol(n.name, { kind: AstKind.ParRef, name: n.name, scope: c, index: index++ });
                            }
                            // TODO: Handle other patterns

                            casePtypes.push(p.type)
                        });

                        c.f.forEach(f => {
                            if (f.value.kind === AstKind.Lambda) {
                                // TODO: Handle other patterns
                                var n = <AstName>f.name;
                                this.addValueSymbol(n.name, { kind: AstKind.ValRef, name: n.name, scope: c, index: index++ });
                                pendingAdding.push(f);
                            } else {
                                var n = <AstName>f.name;
                                flushPending();

                                var val = this.scan(f.value, f.type); // TODO: Get a type from declaration
                                if (n) {
                                    if (f.value.kind === AstKind.ValOfType) {
                                        this.addTypeSymbol(n.name, val);
                                    } else {
                                        // TODO: Assign to variable
                                        this.addValueSymbol(n.name, { kind: AstKind.ValRef, name: n.name, scope: c, index: index++ });
                                    }
                                }
                            }
                        });

                        this.unifyTypeArrayInto(ptypes, casePtypes);

                        assert(c.f.length > 0, "Functions with no bindings nor expressions are not yet supported");

                        ftype = this.unifyTypes(ftype, c.f[c.f.length - 1].type); // TODO: Handle conditional returns
                    });

                    flushPending();

                    lambda.type = { kind: AstKind.TypeLambda, p: ptypes, f: [ftype] };

                    lambda.scanState = ScanState.Scanned;
                    this.scanContext = oldScanContext;
                }

                break;
            }

            case AstKind.Name: {
                var name = <AstName>m;
                var sym = this.findValueSymbol(name.name);
                if (sym) {
                    var ref = <AstValRef>m;
                    ref.kind = AstKind.ValRef;
                    // TODO: Handle type constructors
                    console.log("Found value symbol", name.name);
                    console.log(ref);
                    return sym;
                } else {
                    return name;
                }
            }
        }
    }
}