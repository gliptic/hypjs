/// <reference path="../src/transducers.d.ts" />
/// <reference path="../src/route.d.ts" />
/// <reference path="../src/render.d.ts" />
/// <reference path="../src/packer.d.ts" />
/// <reference path="../src/hyp.d.ts" />

import route = require('route')
import _ = require('transducers')
import render = require('render')
import hyp = require('hyp')

console.log('Running test.js');

function assert(c, msg?) {
    if (!c) console.log('Assert failure. ' + (msg || ''));
}

export function testunpack() {
    var arr = new Uint8Array([
        1 * 2 - 1, // 1 statement without return
        ExprId.Function, 0,
            1, // 1 locals (fib)
            1 * 2, // 1 statement with return
            ExprId.BinAssign,
                0,
                ExprId.Function, 1, // 1 parameter (x)
                    0, // 0 locals
                    1 * 2 - 1, // 1 statement without return
                    ExprId.If, 1, // if () {} else {}
                        ExprId.BinEq, 0 /* x */, ExprId.Integer, 1,
                        1 * 2, ExprId.Integer, 1, // return 1

                        1 * 2, ExprId.BinPlus,
                            ExprId.Call,
                                1, /* fib */
                                1,
                                ExprId.BinMinus, 0 /* x */, ExprId.Integer, 1, // x - 1
                            ExprId.Call,
                                1, /* fib */
                                1,
                                ExprId.BinMinus, 0 /* x */, ExprId.Integer, 2 // x - 2
    ]);
    var x = unpack(arr);

    console.log('len: ' + arr.length);
    console.log('len2: ' + x.length);
    console.log(arr);
    console.log(x);
}

export function run() {
    var process = _.filter(x => x <= 3)
                    .map((x: number) => x + 1)
                    .take(2)

    var rend = render.root(document.getElementById('root'));

    var aNodes = _(_.range(100))
        .map(x => {
            if (x & 1) return { tag: 'div', attr: { 'class': 'box' } };
            return { tag: 'div', attr: { 'class': 'blue box' } };
        })
        .to([]);

    var bNodes = _(_.range(10))
        .map(x => {
            if (x & 2) return { tag: 'div', attr: { 'class': 'blue box' } };
            return { tag: 'div', attr: { 'class': 'box' } };
        })
        .to([]);

    /*
    var before = performance.now();
    for (var i = 0; i < 100; ++i) {
        rend(aNodes);
        rend(bNodes);
    }
    var after = performance.now();
    console.log((after - before) + 'ms');
    */

    console.log('bNodes:', bNodes);

    var routes = [
        route('/a', () => {
            rend(aNodes);
            console.log('a!');
        }),
        route('/b', () => {
            rend(bNodes);
            console.log('b!');
        }),
        route('*', () => { console.log('dunno'); }),
    ];

    route.url
        .match(routes)
        .to(routeAction => routeAction());

    var r = _([1, 2, 3, 4, 5, 6]).comp(process).to([]);
    assert(r[1] === 3);

    var l = _([1, 2, 3]).drop(1).lazy();
    assert(l.next().value === 2);

    var l = _([[5, 6, 7], [8, 9, 10]]).cat().drop(4).lazy();
    assert(l.next().value === 9);

    function regEvent(node, eventName) {
        var s = _.sig();
        var f = e => {
            if (s.r(e)) {
                console.log('Unregistering');
                node.removeEventListener(eventName, f);
            }
        };
        node.addEventListener(eventName, f);
        return s;
    }

    var e = regEvent(document, 'click');

    e.timegaps()
     .map(x => x.gap)
     .drop(1)
     .take(5)
     .done(grp => console.log('You were slow ' + (grp['true'] ? grp['true'].length : 'no') + ' times'))
     .groupBy((x: number) => x > 200).to();

    e.to = null;

    var endpipe = _.done(arr => console.log('done:', arr))
                .err(e => console.log(e));

    _([1000, 300, 400, 2000])
        .mapcat(t => _.after(t, t), _.ordered())
        .comp(endpipe)
        .to([]);

    _([1000, 300, 400, 2000])
        .mapcat(t => _.after(t, t))
        .comp(endpipe)
        .to([]);

    _([1000, 300, 400, 2000])
        .mapcat(t => _.after(t, t), _.latest())
        .comp(endpipe)
        .to([]);
}

export function testhyp() {
    var parser = hyp.AstParser("f = { x: i32 -> if (x < 2) { 1 } else { f(x-1) + f(x-2) } }");
    var m = parser.ruleModule();

    var c = new hyp.Compiler();
    var arr: string[] = [];
    var res = c.build(m);
    console.log(res);
}