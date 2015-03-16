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

interface ResultRef {
	v: any;
	c: number;
}

interface Reducer {
	(input, res: ResultRef): any; // step
	a?: () => any; // initial
	b?: (v) => any; // result
}

type Transducer = (t: Reducer) => Reducer;

declare var Symbol: any;

define(function () {

	function id(v) {
		return v;
	}

	function isUndef(x): boolean {
		return x === void 0;
	}

	var arrayReducer: Reducer = defaultReducer(
		{ a: () => [], b: id },
		(v, arr) => { arr.push(v); return arr; });
	
	var protocolIterator = Symbol ? Symbol.iterator : '@@iterator';

	function iterator(coll): Iterator {
		var iter = coll[protocolIterator];
		if (iter) return iter.call(coll);
		else if (coll.next) return coll;
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

	function transduce(coll, xform: Transducer, reducer: Reducer, init?): any {
		return reduce(coll, xform(reducer), init);
	}

	function reduced(value) {
		return { __:reduced, v: value };
	}

	function isReduced(x): boolean {
		return x && x.__ == reduced;
	}

	function arrayBind(coll, f, res) {
		
		for (var i = 0; !isReduced(res) && i < coll.length; ++i) {
			res = f(coll[i], res);
		}

		return res;
	}

	function reduce(coll, reducer: Reducer, result?) {
		if (isUndef(result) && reducer.a) result = reducer.a();

		if (Array.isArray(coll)) {
			result = arrayBind(coll, reducer, result);
		} else if (coll.then) {
			result = coll.then(reducer, result);
		} else {
			var iter = iterator(coll), val;
			for (;val = iter.next(), !isReduced(result) && !val.done;) {
				result = reducer(val.value, result);
			}
		}

		return (reducer.b || id)(isReduced(result) ? result.v : result);
	}

	function into<T>(to: T, coll: any, xform: Transducer): T {
		return transduce(coll, xform, arrayReducer, to);
	}

	function defaultReducer(reducer, f: Reducer) {
		f.a = reducer.a;
		f.b = reducer.b;
		return f;
	}

	function map(f: (v: any) => any): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input, res) => reducer(f(input), res));
		};
	}

	function filter(f: (v: any) => boolean): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input, res) => f(input) ? reducer(input, res) : res);
		};
	}

	function take(n: number): Transducer {
		return reducer => {
			var l = n;
			return defaultReducer(reducer, (input, res) => {
				// TODO: It would be better if this was reduced on the last
				// call like in the original. Find some neat way to do that.
				return l-- > 0 ? reducer(input, res) : reduced(res);
			});
		};
	}

	function drop(n: number): Transducer {
		return reducer => {
			var l = n;
			return defaultReducer(reducer, (input, res) =>
				(l-- > 0) ? res : reducer(input, res));
		};
	}

	function takeWhile(f: (v: any) => boolean): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input, res) => {
				return f(input) ? reducer(input, res) : reduced(res);
			});
		};
	}

	function dropWhile(f: (v: any) => boolean): Transducer {
		return reducer => {
			var f2: any = f;
			return defaultReducer(reducer, (input, res) =>
				(f2 && f2(input)) ? res : (f2 = 0, reducer(input, res)));
		};
	}

	// Concatenate a sequence of reducible objects into one sequence
	function cat(reducer: Reducer): Reducer {
		return defaultReducer(reducer, (input, res) => {
			var innerReducer = defaultReducer(reducer, (input2, res2) => {
				var val = reducer(input2, res2);
				return isReduced(val) ? reduced(val) : val;
			});

			return reduce(input, innerReducer, res);
		});
	}

	// Also called flatMap, >>=, bind and others.
	function mapcat(f): Transducer {
		return compose(map(f), cat);
	}

	function pusher(r: Reducer, init: any): (v: any) => boolean {
		var result = init;
		return v => {
			result = r(v, result);
			return !isReduced(result);
		};
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
			reducers = into([], reducers, filter(e => e(v)));
			return !(!reducers.length && !ev.then);
		};

		ev.then = (r, init) => {
			reducers.push(pusher(r, init));
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
		//counter: counter,

		// Signals
		//pusher: pusher,
		//everySecond: everySecond,
		after: after,
		//signal: signal,
		
	};
})
