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
	then(r: (input, res) => any, init?: any): any;
}

type IteratorResult = { value?: any; done?: boolean };

interface Iterator {
	next(): IteratorResult;
}

interface Reducer {
	(input, res): any; // step
	a?: () => any; // initial
	b?: (v) => any; // result
	c?: (v) => any; // clone
}

type Transducer = (t: Reducer) => Reducer;

declare var Symbol: any;

define(function () {

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
	
	var protocolIterator = Symbol ? Symbol.iterator : '@@iterator';

	function iterator(coll): Iterator {
		var iter = coll[protocolIterator];
		if (iter) return iter.call(coll);
		return coll; // Assume it is an iterator already
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

	function arrayBind(coll, f, res) {
		var c = 0;
		for (var i = 0; !c && i < coll.length; ++i) {
			c = f(coll[i], res);
		}
		return c;
	}

	function reduce(coll, reducer: Reducer, init?) {
		var result = init || (reducer.a && reducer.a());
		internalReduce(coll, reducer, result);
		return result;
	}

	function internalReduce(coll, reducer: Reducer, result?) {
		var c = 0;
		if (Array.isArray(coll)) {
			c = arrayBind(coll, reducer, result);
		} else if (coll.then) {
			c = coll.then(reducer, result);
		} else {
			var iter = iterator(coll), val;
			for (;val = iter.next(), !(c || val.done);) {
				c = reducer(val.value, result);
			}
		}

		if (reducer.b) reducer.b(result);
		return c;
	}

	function into<T>(to: T, coll: any, xform: Transducer): T {
		return transduce(coll, xform, arrayReducer, to);
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
	function cat(reducer: Reducer): Reducer {
		return defaultReducer(reducer, (input, res) => {
			// Wrap reducer to make .b into the identity function
			return internalReduce(input, (input2, res2) => reducer(input2, res2), res);
		});
	}

	// Also called flatMap, >>=, bind and others.
	function mapcat(f): Transducer {
		return compose(map(f), cat);
	}

	function bufferAll(r: Reducer) {
		var buffer = [];
		var f: Reducer = (input, res) => { buffer.push(input); console.log('Pushing', input); };
		f.a = r.a;
		f.b = res => {
			console.log('Passing', buffer);
			r(buffer, res)
		};
		return f;
	}

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
		}, ms);
		
		return sig;
	}

	function signal(): Signal {
		var reducers = [];

		var ev: any = (v) => {
			reducers = reducers.filter(e => e(v));
			return !!reducers.length || !!ev.then;
		};

		ev.then = proc => {
			reducers.push(proc);
		};

		return ev;
	}

	return {
		compose: compose,
		transduce: transduce,
		into: into,
		map: map,
		filter: filter,
		take: take,
		takeWhile: takeWhile,
		drop: drop,
		dropWhile: dropWhile,
		cat: cat,
		mapcat: mapcat,
		reducep: reducep,
		reduce: reduce,
		bufferAll: bufferAll,
		//counter: counter,

		// Signals
		process: process,
		//everySecond: everySecond,
		after: after,
		//signal: signal,
		
	};
})
