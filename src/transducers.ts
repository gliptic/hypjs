
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
        return inherit({ b: () => s },
            v => { s.push(v); })
    }

    function objReducer(s: any) {
        s = s || {};
        return inherit({ b: () => s },
            v => objMerge(v, s));
    }

    var protocolIterator = Symbol ? Symbol.iterator : '@@iterator';

    function unspool(coll): Unspool<any> {
        if (coll[protocolIterator])
            return coll[protocolIterator].call(coll);
        return coll; // Arrays, iterators and Unspool implement Unspool
    }

    function objBind(coll, f: Reducer<any>) {
        return Object.keys(coll).some(k => <any>f([k, coll[k]]));
    }

    function objMerge(src, dest) {
        if (Array.isArray(src)) {
            dest[src[0]] = src[1];
        } else {
            objBind(src, v => objMerge(v, dest));
        }
    }

    function reduce(coll, reducer: Reducer<any>): any {
        feed(coll, reducer);
        return reducer.b && reducer.b(true);
    }

    function feed(coll, reducer: Reducer<any>) {
        var c;

        var u = unspool(coll);

        if (u.some) {
            c = u.some(reducer);
        } else {
            var val;
            for (; val = u.next(), !(c || val.done);) {
                c = reducer(val.value);
            }
        }

        return c;
    }

    function inherit(reducer, f): any {
        if (reducer.b) f.b = reducer.b;
        return f;
    }

    function reducep<T>(f: Reducer<T>): Transducer<any, T> {
        return reducer => {
            return inherit(reducer, (input: T) => {
                f(input);
                return reducer(f.b(true));
            });
        };
    }

    function map<I, O>(f: (v: I) => O): Transducer<I, O> {
        return reducer => {
            return inherit(reducer, (input: I) => { return reducer(f(input)); });
        };
    }

    function filter<T>(f: (T: any) => boolean): Transducer<T, T> {
        return reducer => {
            return inherit(reducer, (input: T) => { return f(input) && reducer(input); });
        };
    }

    function take<T>(n: number): Transducer<T, T> {
        return reducer => {
            var l = n;
            return inherit(reducer, (input: T) => {
                return --l < 0 || reducer(input) || !l;
            });
        };
    }

    function drop<T>(n: number): Transducer<T, T> {
        return reducer => {
            var l = n;
            return inherit(reducer, (input: T) => {
                return --l < 0 && reducer(input);
            });
        };
    }

    function takeWhile<T>(f: (v: T) => boolean): Transducer<T, T> {
        return reducer => {
            return inherit(reducer, (input: T) => {
                return !f(input) || reducer(input);
            });
        };
    }

    function dropWhile<T>(f: (v: T) => boolean): Transducer<T, T> {
        return reducer => {
            var f2: any = f;
            return inherit(reducer, (input: T) => {
                // This works because reducer(input) will return a falsy value
                // if this reducer may be called again.
                return !(f2 && f2(input)) && (f2 = reducer(input));
            });
        };
    }

    function fold<T>(f: (x: T, y: T) => T, s: T): Reducer<T> {
        var r: Reducer<T> = (input: T) => s = f(s, input);
        r.b = () => s;
        return r;
    }

    // These are functions from transducers to transducers
    function wait<I, O>(next: Transducer<I, O>): Transducer<I, O> {
        var o = 1, res = sig(true);

        // TODO: Combine errors passed through .b() and send

        return inherit({
            b: function () { --o || (res.r(next.b && next.b(true)), res.r.b(true)); return res; }
        }, (reducer: Reducer<O>) => {
            ++o;
            return inherit({
                b: function () { --o || (res.r(next.b && next.b(true)), res.r.b(true)); return res; }
            }, next(reducer));
        });
    }

    function latest<I, O>(next: Transducer<I, O>): Transducer<I, O> {
        var cur = 0;
        return inherit(next, (reducer: Reducer<O>) => {
            var wrapped = next(reducer);
            var me = ++cur;
            return inherit(wrapped, (input: I) => {
                return cur != me || wrapped(input);
            });
        });
    }

    // Concatenate a sequence of reducible objects into one sequence
    function cat(join?: any): Transducer<any, any> {
        join = join || { c: id };
        return (reducer: Reducer<any>) => {
            var sinkCreator = join.to(reducer);
            return inherit(sinkCreator, (input) => {
                return feed(input, sinkCreator());
            });
        };
    }

    function match<I, O>(coll: ((v: I) => O)[]): Transducer<I, O> {
        return reducer => {
            return inherit(reducer, (input: I) => {
                var c;
                coll.some(x => {
                    var v = x(input);
                    return (v != void 0) && (c = reducer(v), true);
                });
                return c;
            });
        };
    }

    function every(interval: number): Signal<number> {
        var s = sig();

        function set() {
            setTimeout(() => {
                s.r(1) || set();
            }, interval);
        }

        set();

        return s;
    }

    function after<T>(ms: number, v?: T): Signal<T> {
        var s = sig();

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

        s.c = s;

        s.r = (val) => {
            DEBUG_SIGNALS && log('signalled', val, 'subs:', subs.length);
            if (CHECK_CYCLES) {
                assert(!isProcessing, 'Cyclic signal');
                isProcessing = true;
            }
            lastValue = val;
            subs = subs.filter(lease => !lease(val) || (lease.b && lease.b(true), false));
            if (CHECK_CYCLES) { isProcessing = false }
            return !subs.length && !s.some;
        };

        s.r.b = e => {
            DEBUG_SIGNALS && log('end signal, subs:', subs.length);
            MISUSE_CHECK && assert(e, 'End condition must be a truthy value');
            endCond = e;
            subs = subs.filter(lease => (lease.b && lease.b(endCond), false));
        };

        s.some = (reducer: Reducer<T>) => {
            DEBUG && log('registered sub, lastValue =', lastValue);
            // While it would be more "correct" for this to return the
            // status of 'reducer', it's not very useful or predictable.
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

    function done<T>(ev: Reducer<T>): Transducer<T, T> {
        return reducer => {
            // TODO: We may need inherit here if more properties are added to Reducer
            var r: Reducer<T> = (input: any) => reducer(input);
            r.b = function (endcond) {
                var v = reducer.b(endcond);
                ev(v);
                ev.b && ev.b(true);
                return v;
            };
            return r;
        }
    }

    function err<T>(ev: Reducer<T>): Transducer<T, T> {
        return reducer => {
            // TODO: We may need inherit here if more properties are added to Reducer
            var r: Reducer<T> = (input: any) => reducer(input);
            r.b = function (endcond) {
                if (endcond !== true) {
                    ev(endcond);
                }
                return reducer.b && reducer.b(true);
            };
            return r;
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
            s.some(() => reducer(latest));
            return inherit(reducer, (input) => {
                latest = input;
            });
        };
    }

    function delay(d: number) {
        return reducer => {
            return inherit(reducer, (input) => {
                after(d).some(() => reducer(input));
            });
        };
    }

    function timeInterval() {
        return reducer => {
            var last = +new Date();
            return inherit(reducer, (input) => {
                var now = +new Date(), span = now - last;
                last = now;
                return reducer({ v: input, interval: span });
            });
        };
    }

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

        sample: sample,
        delay: delay,
        timeInterval: timeInterval,

        comp: td => td.f,
    }

    var joinProto: any = {
        
        wait: () => wait,
        latest: () => latest,
        
        comp: td => td.f,
    }

    var mod: any = function (coll) {
        var x = Object.create(tdProto);
        x.c = coll;
        return x;
    }

    // Signals
    //everySecond: everySecond,
    mod.every = every;
    mod.after = after;
    mod.sig = sig;

    function reg(proto, funcs) {
        objBind(funcs, v => {
            var innerF = v[1];
            mod[v[0]] = proto[v[0]] = function () {
                var t = innerF.apply(0, arguments),
                    x = Object.create(proto),
                    f = this.f;

                x.f = f ? r => f(t(r)) : t;
                x.c = this.c;
                return x;
            };
        });
    }

    reg(tdProto, tdProto);
    reg(joinProto, joinProto);

    tdProto.to = function (dest, join?) {
        var r = this.f(Array.isArray(dest) ? arrayReducer(dest) : dest);
        // TODO: We need some sensible default join logic. Should
        // the signal set one on the tdProto object? But it's not
        // really the signal's concern.
        if (join) {
            r = join.to(r)();
        }
        return this.c ? reduce(this.c, r) : r;
    }
    tdProto.toObj = function (dest) {
        return this.to(objReducer(dest));
    }
    tdProto.mapcat = function (f, join?) { return this.map(f).cat(join); };
    tdProto.lazy = function (): Unspool<any> {
        var iter = unspool(this.c);
        if (!this.f) return iter;

        var buf = [],
            i = 0,
            r = this.f(arrayReducer(buf));

        // TODO: Using inherit here might be wrong if it will transfer other properties than .b
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

                /*
                if (i === buf.length) {
                    buf.length = i = 0;
                    if (feed(iter, input => { r(input.value); return buf.length; }))
                        return { done: true };
                }
                */

                return { value: buf[i++] };
            }
        });
        u[protocolIterator] = () => u;
        return u;
    }

    tdProto.fold = fold;

    joinProto.to = function (dest) {
        return this.f(inherit(dest, () => {
            return (input) => dest(input);
        }));
    }

    return mod;
})
