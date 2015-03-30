/// <reference path="../src/transducers.d.ts" />
/// <reference path="../src/route.d.ts" />
/// <reference path="../src/render.d.ts" />

import route = require('route')
import _ = require('transducers')
import render = require('render')

console.log('Running test.js');

function assert(c, msg?) {
    if (!c) console.log('Assert failure. ' + (msg || ''));
}

export function run() {
    var process = _.filter(x => x <= 3)
                    .map((x: number) => x + 1)
                    .take(2)

    var rend = render.root(document.getElementById('root'));

    var routes = [
        route('/a', () => {
            rend([
                { tag: 'div', attr: {} },
                { tag: 'div', attr: {} }
            ]);
            console.log('a!');
        }),
        route('/b', () => {
            rend([
                { tag: 'div', attr: {}},
                { tag: 'div', attr: {}},
                { tag: 'div', attr: {}}
            ]);
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
     .map(x => x.interval)
     .drop(1)
     .take(5)
     .done(grp => console.log('You were slow ' + (grp['true'] ? grp['true'].length : 'no') + ' times'))
     .groupBy((x: number) => x > 200).to();

    e.some = null;

    _([1000, 300, 400, 2000])
        .mapcat(t => _.after(t, t))
        .done(arr => console.log('done:', arr))
        .err(e => console.log(e))
        .to([]);
}
