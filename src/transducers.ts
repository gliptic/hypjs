
type IteratorResult = { value?: any; done?: boolean };

interface Iterator { next(): IteratorResult; }

declare var Symbol: any;

define(function () {

	/** @const */
	var DEBUG = false;
	/** @const */
	var CHECK_CYCLES = DEBUG || false;
	/** @const */
	var DEBUG_SIGNALS = DEBUG || false;
	/** @const */
	var SIMULATE_RANDOM_ERRORS_IN_SIGNAL = false;
	
	function id(v) {
		return v;
	}

	function nop() {}

	var arrayReducer: Transducer<any, any[]> = (s: any) => {
		s = s || [];
		return inherit({ b: () => s },
			v => { s.push(v); })
	};

	var objReducer: Transducer<any, any> = (s: any) => {
		s = s || {};
		return inherit({ b: () => s },
			v => objMerge(v, s));
	};

	var protocolIterator = Symbol ? Symbol.iterator : '@@iterator';

	function iterator(coll): Iterator {
		if (coll[protocolIterator])
			return coll[protocolIterator].call(coll);
	}

	function compose<A, B, C>(a: Transducer<A, B>, b: Transducer<B, C>): Transducer<A, C> {
		return function(r: any) {
			return a(b(r));
		}
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

	function getReducer(v) {
		if (Array.isArray(v))
			return arrayReducer(v);
		else if (typeof v == "object")
			return objReducer(v);
		else
			return v; // Assume it is a reducer
	}

	function reduce(coll, reducer: Reducer<any>): any {
		feed(coll, reducer);
		return reducer.b && reducer.b(true);
	}

	function feed(coll, reducer: Reducer<any>) {
		var c = false;
		if (Array.isArray(coll)) {
			c = coll.some(reducer);
		} else if (coll.then) {
			coll.then(reducer);
		} else {
			var iter = iterator(coll), val;
			if (!iter) {
				c = objBind(coll, reducer);
			} else {
				for (;val = iter.next(), !(c || val.done);) {
					c = reducer(val.value);
				}
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

	function fold<T>(f: (x: T, y: T) => T): Transducer<T, T> {
		return (s: any) => {
			var r: Reducer<T> = (input: T) => s = f(s, input);
			r.b = () => s;
			return r;
		};
	}

	// These are functions from transducers to transducers
	function wait<I, O>(next: Transducer<I, O>): Transducer<I, O> {
		var o = 1, res = sig(true);

		// TODO: Combine errors passed through .b() and send

		return inherit({
			b: function () { --o || (res(next.b && next.b(true)), res.b(true)); return res; }
		}, (reducer: Reducer<O>) => {
			++o;
			return inherit({
				b: function () { --o || (res(next.b && next.b(true)), res.b(true)); return res; }
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

	function toJoin(reducer: Reducer<any>): Transducer<any, any> {
		return inherit(reducer, () => {
			return (input) => reducer(input);
		});
	}

	// Concatenate a sequence of reducible objects into one sequence
	function cat(join?: any): Transducer<any, any> {
		join = join || { c: id };
		return (reducer: Reducer<any>) => {
			var tempJoin = join.to(reducer);
			return inherit(tempJoin, (input) => {
				return feed(input, tempJoin());
			});
		};
	}

	// Also called flatMap, >>=, bind and others.
	function mapcat<I>(f: (v: I) => any, join?: Transducer<any, any>): Transducer<I, any> {
		return compose(map(f), cat(join));
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

	function process<T>(r: Reducer<T>): Reducer<T> {
		var c = false;
		return v => c || (c = r(v));
	}

	function every(interval: number): Signal<number> {
		var s = sig();

		function set() {
			setTimeout(() => {
				s(1) || set();
			}, interval);
		}

		set();

		return s;
	}

	function after<T>(ms: number, v?: T): Signal<T> {
		var s = sig();

		setTimeout(() => {
			if (SIMULATE_RANDOM_ERRORS_IN_SIGNAL && Math.random() < 0.3)
				s.b(new Error("Error in delay"));
			else {
				s(v); s.b(true);
			}
		}, ms);
		
		return s;
	}

	function sig<T>(persistent?: boolean): Signal<T> {
		var subs = [],
			endCond,
			isProcessing = false,
			lastValue;

		var s: any = (val) => {
			DEBUG_SIGNALS && console.log('signalled', val, 'subs:', subs.length);
			if (CHECK_CYCLES) {
				if (isProcessing) {
					throw 'Cyclic';
				}
				isProcessing = true;
			}
			lastValue = val;
			subs = subs.filter(lease => !lease(val) || (lease.b && lease.b(true), false));
			if (CHECK_CYCLES) { isProcessing = false }
			return !subs.length || !s.then;
		};

		s.b = e => {
			DEBUG_SIGNALS && console.log('end signal, subs:', subs.length);
			endCond = e || true;
			subs = subs.filter(lease => (lease.b && lease.b(endCond), false));
		};

		s.then = (reducer: Reducer<T>) => {
			
			if (!endCond) {
				if (lastValue == void 0 || !reducer(lastValue)) {
					subs.push(reducer);
				}
			} else {
				reducer.b && reducer.b(endCond);
			}
			
			return lastValue != void 0;
		};

		s.t = sig; // Mark as signal

		return s;
	}

	function done<T>(ev: Reducer<T>): Transducer<T, T> {
		return reducer => {
			var r = inherit(reducer, (input: any) => reducer(input));
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
			var r = inherit(reducer, (input: any) => reducer(input));
			r.b = function (endcond) {
				if (endcond !== true) {
					ev(endcond);
				}
				return reducer.b && reducer.b(true);
			};
			return r;
		};
	}

	function sample(interval: number) {
		return reducer => {
			var latest, s = every(interval);
			s.then(() => reducer(latest));
			return inherit(reducer, (input) => {
				latest = input;
			});
		};
	}

	function delay(d: number) {
		return reducer => {
			return inherit(reducer, (input) => {
				after(d, input).then(input => reducer(input));
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

	var tdProto: any = {

		map: map,
		filter: filter,
		take: take,
		takeWhile: takeWhile,
		drop: drop,
		dropWhile: dropWhile,
		mapcat: mapcat,
		cat: cat,
		match: match,
		err: err,
		done: done,
		reducep: reducep,

		sample: sample,
		delay: delay,
		timeInterval: timeInterval,

		comp: td => td.c,
	}

	var joinProto: any = {
		
		wait: () => wait,
		latest: () => latest,
		
		comp: td => td.c,
	}

	var mod = {
		feed: reduce,

		// Signals
		//process: process,
		//everySecond: everySecond,
		every: every,
		after: after,
		sig: sig,
	};

	objBind(tdProto, v => {
		var innerF = v[1];
		mod[v[0]] = tdProto[v[0]] = function () {
			var t = innerF.apply(0, arguments),
				x = Object.create(tdProto),
				c = this.c;

			x.c = c ? r => c(t(r)) : t;
			return x;
		};
	});

	objBind(joinProto, v => {
		var innerF = v[1];
		mod[v[0]] = joinProto[v[0]] = function () {
			var t = innerF.apply(0, arguments),
				x = Object.create(joinProto),
				c = this.c;

			x.c = c ? r => c(t(r)) : t;
			return x;
		};
	});

	tdProto.to = function (dest) { return this.c(getReducer(dest)); }
	joinProto.to = function (dest) { return this.c(toJoin(dest)); }

	return mod;
})
