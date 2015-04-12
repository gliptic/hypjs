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
        integer <int>
        '?:' <expr> <expr> <expr>
        '[]' <count> [<expr>]                // array ctor
        '{}' <count> [<name> <expr>]         // object ctor
        '[]' <expr> <idx:expr>               // index
        'function' <params:int> <locals:int> <statement-block>
        'for' <statement?> <expr> <expr>
        '()' <expr> <param-count:int> [<expr>]
        'new' <expr> <param-count:int> [<expr>]
*/

declare enum ExprId {
    MaxShortRef = 17,
    False = 17,
    True = 18,
    Undefined = 19,

    FirstBin = 20,
    BinPlus = 20,
    BinMinus = 21,
    BinStar = 22,
    BinSlash = 23,
    BinEq = 24,
    BinNeq = 25,
    BinStrictEq = 26,
    BinStrictNeq = 27,
    BinAssign = 27,
    LastBin = 32,

    FirstUn = 32,
    UnPlus = 32,
    UnMinus = 33,
    UnPreInc = 34,
    UnPreDec = 35,
    FirstPostUn = 36,
    UnPostInc = 36,
    UnPostDec = 37,
    LastUn = 38,

    Integer = 38,

    CrArray = 39,
    CrObject = 40,
    Index = 41,
    Function = 42,
    For = 43,
    Call = 44,
    New = 45,
    
    If = 46,

    FirstNameRef = 47
}

declare var unpack: (arr: Uint8Array) => string;