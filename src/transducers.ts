declare module "transducers" {
	export function compose(...p: Transducer[]): Transducer;
	export function transduce(coll, xform: Transducer, reducer: Reducer, init?): any;
	export function into<T>(to: T, coll: any, xform: Transducer): T;
	export function map(f: (v: any) => any): Transducer;
	export function filter(f: (v: any) => boolean): Transducer;
	export function take(n: number): Transducer;
	export function takeWhile(f: (v: any) => boolean): Transducer;
	export function drop(n: number): Transducer;
	export function dropWhile(f: (v: any) => boolean): Transducer;
	export function cat(r: Reducer): Reducer;
	export function mapcat(f: (v: any) => any): Transducer;
}

interface Signal {
	(v: any): boolean;
	done(): any;
	then(r: (input, res) => any, init?: any): any;
}

type IteratorResult = { value?: any; done?: boolean };

interface Iterator {
	next(): IteratorResult;
}

interface Reducer {
	(input, res): any; // step
	a?: () => any; // initial
	b?: (v) => void; // result
	c?: (v) => any; // clone
	d?: (v, diff) => void;
}

type Transducer = (t: Reducer) => Reducer;

declare var Symbol: any;

define(function () {

	/** @const */
	var ENABLE_FLUENT = true;

	function id(v) {
		return v;
	}

	function nop() {
	}

	function isUndef(x): boolean {
		return x === void 0;
	}

	var arrayReducer: Reducer = defaultReducer(
		{ a: () => [], b: nop },
		(v, arr) => { arr.push(v); });

	var objReducer: Reducer = defaultReducer(
		{ a: () => {}, b: nop },
		objMerge);
	
	var protocolIterator = Symbol ? Symbol.iterator : '@@iterator';

	function iterator(coll): Iterator {
		var iter = coll[protocolIterator];
		if (iter) return iter.call(coll);
	}

	function compose(...p: Transducer[]): Transducer;
	function compose() {
		var args = arguments;
		return function(r: Reducer) {
			var value = r;
			for(var i = args.length - 1; i >= 0; i--) {
				value = args[i](value);
			}
			return value;
		}
	}

	function transduce<T>(coll, xform: Transducer, reducer: Reducer, init?: T): T {
		return reduce(coll, xform(reducer), init);
	}

	function arrayBind(coll, f, res?) {
		
		/*
		var c = 0;
		for (var i = 0; !c && i < coll.length; ++i) {
			c = f(coll[i], res);
		}
		return c;
		*/
		return coll.some(v => <any>f(v, res)); // TODO: Measure performance, for vs. forEach vs. some
	}

	function objBind(coll, f, res?) {
		/*
		var c = 0;
		arrayBind(Object.keys(coll), k => {
			c = f([k, coll[k]], res);
		});
		return c;
		*/
		return Object.keys(coll).some(k => <any>f([k, coll[k]], res));
		
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

	function reduce(coll, reducer: Reducer, init?) {
		var result = init || (reducer.a && reducer.a());
		internalReduce(coll, reducer, result);
		return result;
	}

	function internalReduce(coll, reducer: Reducer, result?, skipFinish?: boolean) {
		var c = false;
		if (Array.isArray(coll)) {
			c = arrayBind(coll, reducer, result);
		} else if (coll.then) {
			c = coll.then(reducer, result);
		} else {
			var iter = iterator(coll), val;
			if (!iter) {
				c = objBind(coll, reducer, result);
			} else {
				for (;val = iter.next(), !(c || val.done);) {
					c = reducer(val.value, result);
				}	
			}
			
		}

		if (!skipFinish && reducer.b) reducer.b(result);
		return c;
	}

	function into<T>(to: T, coll: any, xform: Transducer): T {
		return transduce(coll, xform, getReducer(to), to);
	}

	function defaultReducer(reducer, f: Reducer) {
		if (reducer.a) f.a = reducer.a;
		if (reducer.b) f.b = reducer.b;
		return f;
	}

	function reducep(f: Reducer, init?) {
		var result = init || (f.a && f.a());
		return reducer => {
			return defaultReducer(reducer, (input, res) => {
				f(input, result);
				return reducer(result, res);
			});
		};
	}

	function map(f: (v: any) => any): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input, res) => { return reducer(f(input), res); });
		};
	}

	function filter(f: (v: any) => boolean): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input, res) => { return f(input) && reducer(input, res); });
		};
	}

	function take(n: number): Transducer {
		return reducer => {
			var l = n;
			return defaultReducer(reducer, (input, res) => {
				return --l < 0 || reducer(input, res) || !l;
			});
		};
	}

	function drop(n: number): Transducer {
		return reducer => {
			var l = n;
			return defaultReducer(reducer, (input, res) => {
				return --l < 0 && reducer(input, res);
			});
		};
	}

	function takeWhile(f: (v: any) => boolean): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input, res) => {
				return !f(input) || reducer(input, res);
			});
		};
	}

	function dropWhile(f: (v: any) => boolean): Transducer {
		return reducer => {
			var f2: any = f;
			return defaultReducer(reducer, (input, res) => {
				return !f2 || !f2(input) && (f2 = 0, reducer(input, res));
			});
		};
	}

	// Concatenate a sequence of reducible objects into one sequence
	function cat(): Transducer {
		return (reducer: Reducer) => {
			return defaultReducer(reducer, (input, res) => {
				return internalReduce(input, reducer, res, true);
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

	function process(r: Reducer, result?: any): (v: any) => boolean {
		var c = false;
		return v => c || (c = r(v, result));
	}

	function counter(reducer: Reducer): Reducer {
		var c = 0;
		return defaultReducer(reducer, (input, res) => reducer([input, ++c], res));
	}

	function everySecond(): Signal {
		var sig = signal();

		function set() {
			setTimeout(() => {
				if (sig(1)) set();
			}, 1000);
		}

		set();

		return sig;
	}

	function after(ms: number, v?: any): Signal {
		var sig = signal();

		setTimeout(() => {
			sig(v);
			sig.done();
		}, ms);
		
		return sig;
	}

	function join(): Transducer {
		return (reducer: Reducer) => {

			var r: Reducer = (input, res) => reducer(input, res.s);

			r.a = function () {
				return {
					s: reducer.a && reducer.a(),
					o: 1 // We count calling .b in outstanding
				};
			};

			r.b = function (res) {
				r.d(res, -1);
			};

			r.d = function (res, diff) {
				(res.o += diff) || res(res.s);
			}

			return r;
		};
	}

	function signal(persistent?: boolean): Signal {
		var reducers = [],
			values = [];

		var ev: any = (v) => {
			persistent && values.push(v);
			reducers = reducers.filter(r => !r(v) || !r.b());
			return !!reducers.length || !!ev.then;
		};

		ev.then = (reducer: Reducer, result) => {
			reducer.d && reducer.d(result, 1);

			var receiver: Reducer = function(input) {
				return reducer(input, result);
			}

			receiver.b = function() {
				reducer.d && reducer.d(result, -1);
			}

			reducers.push(receiver);
		};

		ev.done = () => {
			reducers = reducers.filter(r => {
				return r.b();
			}); // NOTE: Assumes .b returns a false value
		};

		return ev;
	}

	var transducerFunctions = {
		map: map,
		filter: filter,
		take: take,
		takeWhile: takeWhile,
		drop: drop,
		dropWhile: dropWhile,
		mapcat: mapcat,
		cat: cat,
		join: join,
	};

	var mod;

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
				var td = r => lhs(rhs(r));
				objBind(transducerFunctions, v2 => { td[v2[0]] = mod[v2[0]] });
				td.apply = function (from, to) { return into(to, from, this); };
				return td;
			}

			mod[v[0]] = fluentWrapper;
		});
	} else {
		mod = transducerFunctions;
	}
	/* else {
		var fluentMethods = {};
		transducerKeys.forEach(k => {
			var innerF = transducerFunctions[k];

			function fluentWrapper() {
				var lhs = this.td;
				var args = Array.prototype.slice.call(arguments);
				var rhs = r => lhs(innerF.apply(null, args)(r));
				return { coll: this.coll, td: rhs };
			}

			fluentMethods[k] = fluentWrapper;
		});

		mod = function (coll) {
			var obj = { coll: coll, td: id };
			transducerKeys.forEach(k => {
				obj[k] = fluentMethods[k]
			});
		};
	}*/

	objMerge({
			transduce: transduce,
			into: into,
			compose: compose,
			
			
			arrayReducer: arrayReducer,
			
			reducep: reducep,
			reduce: reduce,
			//bufferAll: bufferAll,
			//counter: counter,

			// Signals
			process: process,
			//everySecond: everySecond,
			after: after,
			//signal: signal,
		}, mod);

	return mod;
})
