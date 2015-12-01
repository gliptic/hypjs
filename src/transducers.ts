/// <reference path="transducers.d.ts" />
/// <reference path="amd.d.ts" />

declare var Symbol: any;

define(function () {

    /** @const */
    var DEBUG = false;
    /** @const */
    var MISUSE_CHECK = DEBUG || false;
    /** @const */
    var CHECK_CYCLES = DEBUG || false;
    /** @const */
    var DEBUG_SIGNALS = DEBUG || false;
    /** @const */
    var SIMULATE_RANDOM_ERRORS_IN_SIGNAL = false;

    function log(...p: any[]);
    function log() { console.log.apply(console, arguments) };
    
    function id(v) { return v; }

    function nop() { }

    function assert(cond, msg) {
        if(!(cond)) throw new Error('Assert fail: ' + msg); 
    }
    
    function arrayReducer(s: any) {
        s = s || [];
        return inherit({
            b: () => {
                DEBUG && log('.b on arrayReducer:', s);
                return s;
            }
        }, v => { s.push(v); });
    }

    function objReducer(s: any) {
        s = s || {};
        return inherit({ b: () => s },
            v => objMerge(v, s));
    }

    var protocolIterator = typeof Symbol === 'undefined' ? '@@iterator' : Symbol.iterator;

    function unspool(coll): Unspool<any> {
        if (coll[protocolIterator]) {
            return coll[protocolIterator].call(coll);
        } else if (Array.isArray(coll)) {
            return {
                to: function (r) {
                    coll.some(r);
                    r.b && r.b(true);
                },
                
            };
        }
        return coll; // Iterators and Unspool implement Unspool
    }

    function range(min, max) {
        if (max === void 0) {
            max = min;
            min = 0;
        }
        var i = {};
        i[protocolIterator] = () => {
            var n = min;
            return {
                next: (): IteratorResult<number> => {
                    return n++ < max ? { value: n } : { done: true };
                }
            }
        };
        return i;
    }

    function objBind(coll, f: Reducer<any, any>) {
        return Object.keys(coll).some(k => <any>f([k, coll[k]]));
    }

    function objMerge(src, dest) {
        if (Array.isArray(src)) {
            dest[src[0]] = src[1];
        } else {
            objBind(src, v => objMerge(v, dest));
        }
    }

    function feed(coll, reducer: Reducer<any, any>) {
        var u = unspool(coll);

        if (u.to) {
            u.to(reducer);
        } else {
            var val, c;
            for (; val = u.next(), !(c || val.done);) {
                c = reducer(val.value);
            }
            reducer.b && reducer.b(true);
        }
    }

    function inherit(reducer, f): any {
        if (reducer.b) f.b = reducer.b;
        return f;
    }

    function reducep<T>(f: Reducer<T, any>): Transducer<any, T> {
        return reducer => {
            return inherit(reducer, (input: T) => {
                f(input);
                return reducer(f.b(true));
            });
        };
    }

    function map<I, O>(f: (v: I) => O): Transducer<I, O> {
        return reducer => {
            return inherit(reducer, function (input) {
                return reducer(f(input));
            });
        };
    }

    function filter<T>(f: (T: any) => boolean): Transducer<T, T> {
        return reducer => {
            return inherit(reducer, function (input) {
                return f(input) && reducer(input);
            });
        };
    }

    function take<T>(n: number): Transducer<T, T> {
        return reducer => {
            var l = n;
            return inherit(reducer, function (input) {
                return --l < 0 || reducer(input) || !l;
            });
        };
    }

    function drop<T>(n: number): Transducer<T, T> {
        return reducer => {
            var l = n;
            return inherit(reducer, function (input) {
                return --l < 0 && reducer(input);
            });
        };
    }

    function takeWhile<T>(f: (v: T) => boolean): Transducer<T, T> {
        return reducer => {
            return inherit(reducer, function (input) {
                return !f(input) || reducer(input);
            });
        };
    }

    function dropWhile<T>(f: (v: T) => boolean): Transducer<T, T> {
        return reducer => {
            var f2: any = f;
            return inherit(reducer, function (input) {
                // This works because reducer(input) will return a falsy value
                // if this reducer may be called again.
                return !(f2 && f2(input)) && (f2 = reducer(input));
            });
        };
    }

    function fold<A, B>(f: (x: A, y: B) => A): Transducer<B, any> {
        return (s: any) => {
            return inherit({
                b: () => s
            }, (input: B) => s = f(s, input));
        }
    }

    // Reducers

    function groupBy(f) {
        return () => {
            var groups = {};
            return inherit({
                b: () => groups
            }, function (input) {
                var k = f(input);
                (groups[k] = groups[k] || []).push(input);
            });
        }
    }

    function some(f?) {
        return () => {
            var v;
            return inherit({
                b: () => v
            }, function (input) {
                return v = !f || f(input);
            });
        };
    }

    function first(f?) {
        return () => {
            var v;
            return inherit({
                b: () => v
            }, function (input) {
                if (!f || f(input)) {
                    v = input;
                    return true;
                }
            });
        };
    }

    function wait<O, R>(reducer: Reducer<O, R>): () => Reducer<O, R> {
        var o = 1, lastEndcond = true;

        // TODO: Combine errors better

        return inherit({
            b: function (endcond) {
                DEBUG && log('.b on wait:', o - 1);
                if (endcond !== true) lastEndcond = endcond;
                if (!--o) { return reducer.b && reducer.b(lastEndcond); }
            }
        }, () => {
            ++o;
            return inherit({
                b: function (endcond) {
                    DEBUG && log('.b on wait:', o - 1);
                    if (endcond !== true) lastEndcond = endcond;
                    if (!--o) { return reducer.b && reducer.b(lastEndcond); }
                }
            }, input => reducer(input));
        });
    }

    function latest() {
        return <I, O>(next: any): any => {
            var cur = 0;
            return inherit(next, () => {
                var wrapped = next();
                var me = ++cur;
                return inherit(wrapped, (input) => {
                    return cur ^ me || wrapped(input);
                });
            });
        };
    }

    function ordered() {
        return <I, O>(next: any): any => {
            var tail = 0, queue = [], head = 0;

            return inherit(next, () => {
                var wrapped = next(),
                    me = tail++,
                    arr = [];

                return inherit({
                    b: function (endcond) {
                        queue[me] = function () {
                            arr.some(wrapped);
                            wrapped.b();
                            queue[me] = null;
                        };
                        
                        while (queue[head]) queue[head++]();
                    }
                }, (input) => {
                    arr.push(input);
                    if (me == head) {
                        var r = arr.some(wrapped);
                        arr = [];
                        return r;
                    }
                });
            });
        };
    }

    // Concatenate a sequence of reducible objects into one sequence
    function cat(join?: any): Transducer<any, any> {
        return reducer => {
            var r: any = wait(reducer);
            if (join) r = join.f(r);
            return inherit(r, input => {
                feed(input, r());
                return;
            });
        };
    }

    function match<I, O>(coll: ((v: I) => O)[]): Transducer<I, O> {
        return reducer => {
            return inherit(reducer, (input: I) => {
                var c;
                coll.some(x => {
                    var v = x(input);
                    return (v !== void 0) && (c = reducer(v), true);
                });
                return c;
            });
        };
    }

    function every(interval: number): Signal<number> {
        var s = sig<number>();

        function set() {
            setTimeout(() => {
                s.r(1) || set();
            }, interval);
        }

        set();

        return s;
    }

    function after<T>(ms: number, v?: T): Signal<T> {
        var s = sig<T>();

        DEBUG && log('calling after, ms =', ms)

        setTimeout(() => {
            DEBUG && log('triggering after');
            if (SIMULATE_RANDOM_ERRORS_IN_SIGNAL && Math.random() < 0.3)
                s.r.b(new Error("Error in delay"));
            else {
                s.r(v); s.r.b(true);
            }
        }, ms);
        
        return s;
    }

    function sig<T>(persistent?: boolean): Signal<T> {
        var subs = [],
            endCond,
            isProcessing = false,
            lastValue;

        var s: any = Object.create(tdProto);

        ((s.c = s).r = <any>function (val) {
            DEBUG_SIGNALS && log('signalled', val, 'subs:', subs.length);
            if (CHECK_CYCLES) {
                assert(!isProcessing, 'Cyclic signal');
                isProcessing = true;
            }
            lastValue = val;
            subs = subs.filter(lease => !lease(val) || (lease.b && lease.b(true), false));
            if (CHECK_CYCLES) { isProcessing = false }
            return !subs.length && !s.to;
        }).b = e => {
            DEBUG_SIGNALS && log('end signal, subs:', subs.length);
            MISUSE_CHECK && assert(e, 'End condition must be a truthy value');
            endCond = e;
            subs = subs.filter(lease => (lease.b && lease.b(endCond), false));
        };

        s.to = (reducer: Reducer<T, any>) => {
            DEBUG && log('registered sub, lastValue =', lastValue);
            if (!endCond) {
                if (lastValue == void 0 || !reducer(lastValue)) {
                    subs.push(reducer);
                }
            } else {
                reducer.b && reducer.b(endCond);
            }
        };

        s.cur = () => lastValue;

        s.t = sig; // Mark as signal

        return s;
    }

    function done<T>(ev: Reducer<T, any>): Transducer<T, T> {
        return reducer => {
            // TODO: We may need inherit here if more properties are added to Reducer
            return inherit({
                b: function (endcond) {
                    var v = reducer.b(endcond);
                    DEBUG && log('.b on done:', v);
                    ev(v);
                    ev.b && ev.b(true);
                    return v;
                }
            }, input => reducer(input));
        }
    }

    function err<T>(ev: Reducer<any, any>): Transducer<T, T> {
        return reducer => {
            // TODO: We may need inherit here if more properties are added to Reducer
            return inherit({
                b: function (endcond) {
                    if (endcond !== true) {
                        ev(endcond);
                    }
                    return reducer.b && reducer.b(true);
                }
            }, input => reducer(input));
        };
    }

    function around(f) {
        return reducer => {
            return inherit(reducer, input => f(() => reducer(input)));
        };
    }

    // Time-based xforms

    function sample(interval: number) {
        return reducer => {
            var latest, s = every(interval);
            s.to(() => reducer(latest));
            return inherit(reducer, input => {
                latest = input;
            });
        };
    }

    function delay(d: number) {
        return reducer => {
            return inherit(reducer, (input) => {
                after(d).to(() => reducer(input));
            });
        };
    }

    var Timer = typeof performance !== 'undefined' && performance.now ?
        performance :
        Date;

    function timegaps() {
        return reducer => {
            var last = Timer.now();
            return inherit(reducer, (input) => {
                var now = Timer.now(), gap = now - last;
                last = now;
                return reducer({ v: input, gap: gap });
            });
        };
    }

    function timestamp() {
        return reducer => {
            return inherit(reducer, (input) => {
                return reducer({ v: input, t: Timer.now() });
            });
        };
    }

    function add(x, y) { return x + y; }

    var deref = () => map((x: any) => x.v);

    var tdProto: any = {

        map: map,
        filter: filter,
        take: take,
        takeWhile: takeWhile,
        drop: drop,
        dropWhile: dropWhile,
        cat: cat,
        match: match,
        err: err,
        done: done,
        reducep: reducep,
        around: around,
        groupBy: groupBy,
        some: some,
        first: first,

        sample: sample,
        delay: delay,
        timegaps: timegaps,
        timestamp: timestamp,

        comp: td => td.f,
    }

    var joinProto: any = {
        
        latest: latest,
        ordered: ordered,
        
        comp: td => td.f,
    }

    var mod: any = function (coll) {
        var x = Object.create(tdProto);
        x.c = coll;
        return x;
    }

    // Signals
    mod.every = every;
    mod.after = after;
    mod.sig = sig;
    mod.range = range;

    function reg(proto, funcs) {
        objBind(funcs, v => {
            var k = v[0];
            var innerF = proto[k];
            mod[k] = proto[k] = function () {
                var t = innerF.apply(0, arguments),
                    x = Object.create(proto),
                    f = this.f;

                x.f = f ? r => {
                    // TODO: If we have a more efficient implementation of
                    // f, f -> t or f -> t -> r, we should use that. That may
                    // be the case if we know this.c is a special type such
                    // as a remote collection.
                    return f(t(r));
                } : t;
                x.c = this.c;
                return x;
            };
        });
    }

    reg(tdProto, tdProto);
    reg(joinProto, joinProto);

    tdProto.to = function (dest) {
        var r = this.f(Array.isArray(dest) ? arrayReducer(dest) : dest);

        if (this.c) {
            r = wait(r);
            // TODO: Add back join support when we have any useful joins for .to
            //if (join) r = join.f(r);
            feed(this.c, r());
            return r.b && r.b(true);
        } else {
            return r;
        }
    }
    tdProto.sig = function () {
        var s = sig();
        this.to(s.r);
        return s;
    }
    tdProto.toObj = function (dest) {
        return this.to(objReducer(dest));
    }
    tdProto.fold = fold;
    tdProto.mapcat = function (f, join?) { return this.map(f).cat(join); };
    tdProto.sum = function () { return this.fold(add, 0); }
    tdProto.lazy = function (): Unspool<any> {
        var iter = unspool(this.c);
        if (!this.f) return iter;

        var buf = [],
            i = 0,
            r = this.f(arrayReducer(buf));

        // TODO: Using inherit here might be wrong if it will transfer other properties than .b
        // TODO: Normal users of iterators won't know to call .b. We must expect it not to be called.
        var u = inherit(r, {
            next: function (): IteratorResult<any> {
                while (i === buf.length) {
                    buf.length = i = 0;
                    var val = iter.next();
                    if (val.done) {
                        return { done: true };
                    }
                    r(val.value);
                }

                return { value: buf[i++] };
            }
        });
        u[protocolIterator] = () => u;
        return u;
    }

    return mod;
})
