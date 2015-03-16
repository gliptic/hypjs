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

	function nop() {
	}

	function isUndef(x): boolean {
		return x === void 0;
	}

	var arrayReducer: Reducer = defaultReducer(
		{ a: () => [], b: nop },
		(v, arr: ResultRef) => { arr.v.push(v); });
	
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

	function transduce<T>(coll, xform: Transducer, reducer: Reducer, init?: T): T {
		return reduce(coll, xform(reducer), init);
	}

	function arrayBind(coll, f, res: ResultRef) {
		for (var i = 0; !res.c && i < coll.length; ++i) {
			f(coll[i], res);
		}
	}

	function reduce(coll, reducer: Reducer, init?) {
		var result = { v: isUndef(result) ? reducer.a && reducer.a() : result, c: 0 };
		internalReduce(coll, reducer, result);
		return result.v;
	}

	function internalReduce(coll, reducer: Reducer, result?: ResultRef) {
		
		if (Array.isArray(coll)) {
			arrayBind(coll, reducer, result);
		} else if (coll.then) {
			coll.then(reducer, result);
		} else {
			var iter = iterator(coll), val;
			for (;val = iter.next(), !result.c && !val.done;) {
				reducer(val.value, result);
			}
		}

		if (result.c) --result.c;
		if (reducer.b) reducer.b(result);
	}

	function into<T>(to: T, coll: any, xform: Transducer): T {
		return transduce(coll, xform, arrayReducer, to);
	}

	function defaultReducer(reducer, f: Reducer) {
		if (reducer.a) f.a = reducer.a;
		if (reducer.b) f.b = reducer.b;
		return f;
	}

	function map(f: (v: any) => any): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input, res) => { reducer(f(input), res) });
		};
	}

	function filter(f: (v: any) => boolean): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input, res) => { if (f(input)) reducer(input, res); });
		};
	}

	function take(n: number): Transducer {
		return reducer => {
			var l = n;
			return defaultReducer(reducer, (input, res) => {
				// TODO: It would be better if this was reduced on the last
				// call like in the original. Find some neat way to do that.
				--l < 0 ? ++res.c : reducer(input, res);
			});
		};
	}

	function drop(n: number): Transducer {
		return reducer => {
			var l = n;
			return defaultReducer(reducer, (input, res) => {
				if (--l < 0) reducer(input, res);
			});
		};
	}

	function takeWhile(f: (v: any) => boolean): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input, res) => {
				f(input) ? reducer(input, res) : ++res.c;
			});
		};
	}

	function dropWhile(f: (v: any) => boolean): Transducer {
		return reducer => {
			var f2: any = f;
			return defaultReducer(reducer, (input, res) => {
				(f2 && f2(input)) || (f2 = 0, reducer(input, res));
			});
		};
	}

	// Concatenate a sequence of reducible objects into one sequence
	function cat(reducer: Reducer): Reducer {
		return defaultReducer(reducer, (input, res) => {
			var innerReducer = defaultReducer(reducer, (input2, res2) => {
				reducer(input2, res2);
				if (res2.c) ++res2.c;
			});

			internalReduce(input, innerReducer, res);
		});
	}

	// Also called flatMap, >>=, bind and others.
	function mapcat(f): Transducer {
		return compose(map(f), cat);
	}

	function pusher(r: Reducer, init: any): (v: any) => boolean {
		var result = { v: init.v, c: 0 };
		return v => {
			r(v, result);
			return <any>result.c;
		};
	}

	function counter(reducer: Reducer): Reducer {
		var c = 0;
		return defaultReducer(reducer, (input, res) => { reducer([input, ++c], res) });
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
