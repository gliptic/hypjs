(function () {

    /*
    statement-block :=
        <statement-count:int> [<statements>]

    statement :=
        '=' <expr> <expr>
        'return' <expr>
        expr <expr>
        

    expr :=
        var-ref <debruijn-index>
        name-ref <name-index>
        null
        false
        true
        void 0
        typeof <expr>
        delete <expr> <index:expr>
        ('+'|'-'|'*'|'/'|...) <expr> <expr>  // binary
        ('+'|'-'|'++'|'--'|...) <expr>       // unary
        '?:' <expr> <expr> <expr>
        '[]' <count> [<expr>]                // array ctor
        '{}' <count> [<name> <expr>]         // object ctor
        '[]' <expr> <idx:expr>               // index
        'function' <params:int> <locals:int> <statement-block>
        'for' <statement?> <expr> <expr>
        '()' <expr> <param-count:int> [<expr>]
        'new' <expr> <param-count:int> [<expr>]
    */

    /*
    MaxShortRef = 16,
    False = 17,
    True = 18,
    FirstBin = 19,
    BinPlus = 20,
    BinMinus = 21,
    BinStar = 22,
    BinSlash = 23,
    BinEq = 24,
    BinNeq = 25,
    BinStrictEq = 26,
    BinStrictNeq = 27,
    LastBin = 27,

    FirstUn = 32,
    UnPlus = 32,
    UnMinus = 33,
    UnPreInc = 34, UnPostInc = 35,
    UnPreDec = 36, UnPostDec = 37,
    LastUn = 37,

    Integer = 38,

    CrArray = 39,
    CrObject = 40,
    Index = 41,
    Function = 42,
    For = 43,
    Call = 44,
    New = 45,
    Undefined = 46,
    If = 47,

    FirstNameRef = 48
    */

    unpack = function (arr: Uint8Array) {
        var i = 0,
            locCount = 0,
            out = [];

        function name() {
            return 'name' + arr[i++];
        }

        // 0 -> {}
        // 1 -> { x; }
        // 2 -> { return x; }
        // 3 -> { x; y; }
        // ...
        function statblock() {
            var count = arr[i++];
            for (;count-- > 0;) {
                !--count && push('return ');
                expr();
                push(';');
            }
        }

        function push(x) { out.push(x) }

        /** @const */
        var binopOffset = 3;
        /** @const */
        var unopOffset = binopOffset + (ExprId.LastBin - ExprId.FirstBin);

        var ops = 'false,true,(void 0),+,-,*,/,==,!=,===,!==,=,+,-,++,--,++,--'.split(',');

        function expr() {
            var id = arr[i++];
            if ((id -= ExprId.MaxShortRef) < 0) { // TODO: 16 unused
                push('v' + (locCount - id - ExprId.MaxShortRef));
            } else if ((id -= 3) < 0) {
                push(ops[id + 3]);
            } else if ((id -= (ExprId.LastBin - ExprId.FirstBin)) < 0) {
                var op = ops[id + (binopOffset + (ExprId.LastBin - ExprId.FirstBin))];
                push('(');
                expr();
                push(op);
                expr();
                push(')');
            } else if ((id -= (ExprId.LastUn - ExprId.FirstUn)) < 0) {

                push('(');
                (id < (ExprId.FirstPostUn - ExprId.FirstUn) - (ExprId.LastUn - ExprId.FirstUn) - unopOffset) && push(ops[id + ((ExprId.LastUn - ExprId.FirstUn) + unopOffset)]);
                expr();
                push(')');
                (id >= (ExprId.FirstPostUn - ExprId.FirstUn) - (ExprId.LastUn - ExprId.FirstUn) - unopOffset) && push(ops[id + ((ExprId.LastUn - ExprId.FirstUn) + unopOffset)]);
            } else if (!id--) {
                push('' + arr[i++]);
            } else if (!id--) {
                var count = arr[i++];
                push('[');
                for (;count--;) {
                    expr();
                    count && push(',');
                }
                push(']');
            } else if (!id--) {
                var count = arr[i++];
                push('{');
                for (;count--;) {
                    push(name() + ':');
                    expr();
                    count && push(',');
                }
                push('}');
            } else if (!id--) {
                expr();
                push('[');
                expr();
                push(']');
            } else if (!id--) {
                push('(function(');
                var params = arr[i++];
                var locals = arr[i++];

                for(;params--;) {
                    push('v' + ++locCount);
                    params && push(',');
                }
                push('){');
                for(;locals--;) {
                    push('var v' + ++locCount + ';');
                }
                statblock();
                locCount -= params + locals;
                push('})');
            } else if (!id--) {
                push('for(;');
                expr();
                push(';){');

                statblock();

                push('}');
            } else if (!id--) {
                expr();
                push('(');
                var count = arr[i++];
                for(;count--;) {
                    expr();
                    count && push(',');
                }
                push(')');
            } else if (!id--) {
                push('new ');
                expr();
                push('(');
                var count = arr[i++];
                for(;count--;) {
                    expr();
                    count && push(',');
                }
                push(')');
            
            } else if (!id--) {

                var extra = arr[i++];

                // 0 -> if () { ... }
                // 1 -> if () { ... } else { ... }
                // 2 -> if () { ... } else if () { ... }
                // ...
                while (extra >= 0) {

                    push('if(');
                    expr();
                    push('){');
                    statblock();
                    push('}');

                    if (extra--) {
                        push('else');
                    }

                    if (!extra--) {
                        push('{');
                        statblock();
                        push('}');
                    }
                }
            } else {
                push('name' + id);
            }

        }

        statblock();
        return out.join('');
    }
})()