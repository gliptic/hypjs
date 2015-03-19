
interface Signal {
	(vals: any[], done?: boolean): boolean;
	then(r: Reducer): any;
}

type IteratorResult = { value?: any; done?: boolean };

interface Iterator { next(): IteratorResult; }

declare var Symbol: any;

define(function () {

	/** @const */
	var ENABLE_FLUENT = true;
	/** @const */
	var DEBUG = false;

	function id(v) {
		return v;
	}

	function nop() {
	}

	function isUndef(x): boolean {
		return x === void 0;
	}

	var arrayReducer: Transducer = (_, s) => {
		s = s || [];
		return defaultReducer({ b: () => s },
			v => { s.push(v); })
	};

	var objReducer: Transducer = (_, s) => {
		s = s || {};
		return defaultReducer({ b: () => s },
			v => objMerge(v, s));
	};

	var protocolIterator = Symbol ? Symbol.iterator : '@@iterator';

	function iterator(coll): Iterator {
		var iter = coll[protocolIterator];
		if (iter) return iter.call(coll);
	}

	function compose(a: Transducer, b: Transducer) {
		return function(r: Reducer, initial?) {
			return a(b(r, initial));
		}
	}

	function pipe<T>(coll, xform: Transducer, init?: T): T {
		return reduce(coll, xform(null, init));
	}

	function arrayBind(coll, f: Reducer) {
		
		/*
		var c = 0;
		for (var i = 0; !c && i < coll.length; ++i) {
			c = f(coll[i], res);
		}
		return c;
		*/
		return coll.some(v => <any>f(v)); // TODO: Measure performance, for vs. forEach vs. some
	}

	function objBind(coll, f: Reducer) {
		/*
		var c = 0;
		arrayBind(Object.keys(coll), k => {
			c = f([k, coll[k]], res);
		});
		return c;
		*/
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
			return arrayReducer;
		else if (typeof v == "object")
			return objReducer;
		else
			return arrayReducer; // Default to array
	}

	function reduce(coll, reducer: Reducer): any {
		internalReduce(coll, reducer);
		return reducer.b && reducer.b();
	}

	function internalReduce(coll, reducer: Reducer) {
		var c = false;
		if (Array.isArray(coll)) {
			c = arrayBind(coll, reducer);
		} else if (coll.then) {
			c = coll.then(reducer);
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

/*
	function into<T>(to: T, coll: any, xform: Transducer): T {
		return pipe(coll, compose(xform, getReducer(to)), to);
	}*/

	function defaultReducer(reducer, f: Reducer) {
		if (reducer.b) f.b = reducer.b;
		if (reducer.d) f.d = reducer.d;
		return f;
	}

	function reducep(f: Reducer) {
		return reducer => {
			return defaultReducer(reducer, (input) => {
				f(input);
				return reducer(f.b());
			});
		};
	}

	function map(f: (v: any) => any): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input) => { return reducer(f(input)); });
		};
	}

	function filter(f: (v: any) => boolean): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input) => { return f(input) && reducer(input); });
		};
	}

	function take(n: number): Transducer {
		return reducer => {
			var l = n;
			return defaultReducer(reducer, (input) => {
				return --l < 0 || reducer(input) || !l;
			});
		};
	}

	function drop(n: number): Transducer {
		return reducer => {
			var l = n;
			return defaultReducer(reducer, (input) => {
				return --l < 0 && reducer(input);
			});
		};
	}

	function takeWhile(f: (v: any) => boolean): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input) => {
				return !f(input) || reducer(input);
			});
		};
	}

	function dropWhile(f: (v: any) => boolean): Transducer {
		return reducer => {
			var f2: any = f;
			return defaultReducer(reducer, (input) => {
				return !f2 || !f2(input) && (f2 = 0, reducer(input));
			});
		};
	}

	// Concatenate a sequence of reducible objects into one sequence
	function cat(): Transducer {
		return (reducer: Reducer) => {
			return defaultReducer(reducer, (input) => {
				return internalReduce(input, reducer);
			});
		};
	}

	// Also called flatMap, >>=, bind and others.
	function mapcat(f): Transducer {
		return compose(map(f), cat());
	}

/*
	function bufferAll(r: Reducer) {
		var buffer = [];
		var f: Reducer = (input, res) => { buffer.push(input); };
		f.a = r.a;
		f.b = res => {
			r(buffer, res)
		};
		return f;
	}*/

	function process(r: Reducer): Reducer {
		var c = false;
		return v => c || (c = r(v));
	}

	function counter(reducer: Reducer): Reducer {
		var c = 0;
		return defaultReducer(reducer, (input) => reducer([input, ++c]));
	}

	function everySecond(): Signal {
		var sig = signal();

		function set() {
			setTimeout(() => {
				sig([1]) || set();
			}, 1000);
		}

		set();

		return sig;
	}

	function delay(ms: number, v?: any): Signal {
		var sig = signal();

		setTimeout(() => {
			sig([v], true);
		}, ms);
		
		return sig;
	}

	function wait(): Transducer {
		return (reducer: Reducer) => {

			var o = 1, res = signal(true);

			// Create a new function with the same body
			var r: Reducer = (input) => reducer(input);

			r.b = function () {
				r.d(-1);
				return res;
			};

			r.d = function (diff) {
				(o += diff) || res([reducer.b()], true);
			};

			return r;
		};
	}

	function signal(persistent?: boolean): Signal {
		var subs = [],
			values = [],
			isDone = false;

		var ev: any = (vals, done?) => {
			if(persistent) values = values.concat(vals);
			isDone = done;
			subs = subs.filter(s => s(vals));
			return !subs.length || !ev.then;
		};

		ev.then = (reducer: Reducer) => {
			reducer.d && reducer.d(1);

			var sub = function(values: any[]): boolean {
				if (values.some(reducer) || isDone) {
					reducer.d && reducer.d(-1);
					return false;
				}
				return true;
			}

			if(sub(values)) subs.push(sub);
		};

		return ev;
	}

	function to(init) {
		return () => getReducer(init)(null, init);
	}

	var mod = id;

	var transducerFunctions = {
		map: map,
		filter: filter,
		take: take,
		takeWhile: takeWhile,
		drop: drop,
		dropWhile: dropWhile,
		mapcat: mapcat,
		cat: cat,
		wait: wait,
		to: to,
		toArray: () => arrayReducer
	};

	if (ENABLE_FLUENT) {
		// Methods on transducers for chaining
		//var transducerKeys = Object.keys(transducerFunctions);

		// Mod works like the null transreducer
		mod = id;
		objBind(transducerFunctions, v => {
			var innerF = v[1];
			function fluentWrapper() {
				var rhs = innerF.apply(null, arguments),
					lhs = this;
				var td = compose(lhs, rhs);
				objBind(transducerFunctions, v2 => { td[v2[0]] = mod[v2[0]] });
				//td.apply = function (from) { return transduce(from, this); };
				return td;
			}

			mod[v[0]] = fluentWrapper;
		});
	}

	objMerge({
			pipe: pipe,
			//into: into,
			compose: compose,
			
			reducep: reducep,
			reduce: reduce,

			// Signals
			process: process,
			//everySecond: everySecond,
			delay: delay,
			//signal: signal,
		}, mod);

	return mod;
})
