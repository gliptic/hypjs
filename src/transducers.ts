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
	connect(r: Reducer);
}

type IteratorResult = { value?: any; done?: boolean };

interface Iterator {
	next(): IteratorResult;
}

interface Reducer {
	a: () => any; // initial
	b: (v) => any; // result
	c: (res, input) => any; // step
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

	var arrayReducer = { a: () => [], b: id, c: (arr, v) => { arr.push(v); return arr; } };

	var symbolExists = !isUndef(Symbol);
	var protocolIterator = symbolExists ? Symbol.iterator : '@@iterator';

	function iterator(coll): Iterator {
		var iter = coll[protocolIterator];
		if (iter) return iter.call(coll);
		else if (coll.next) return coll;
		else {
			var index = 0;
			return {
				next: function (): IteratorResult {
					return index < coll.length ? { value: coll[++index] } : { done: true };
				}
			};
		}
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
		var r = xform(reducer);
		if (isUndef(init)) init = r.a();
		return reduce(coll, r, init);
	}

	function reduced(value) {
		return { __:reduced, v: value };
	}

	function isReduced(x): boolean {
		return x && x.__ == reduced;
	}

	function reduce(coll, reducer: Reducer, init) {
		var iter = iterator(coll),
		 	result = init;
			
		for (;;) {
			var val = iter.next();
			if (val.done)
				return reducer.b(result);

			result = reducer.c(result, val.value);

			if (isReduced(result)) {
				return reducer.b(result.v);
			}
		}
	}

	function into<T>(to: T, coll: any, xform: Transducer): T {
		return transduce(coll, xform, arrayReducer, to);
	}

	function map(f: (v: any) => any): Transducer {
		return r => { return {
			a: r.a,
			b: r.b,
			c: (res, input) => r.c(res, f(input))
		}};
	}

	function filter(f: (v: any) => boolean): Transducer {
		return reducer => { return {
			a: reducer.a,
			b: reducer.b,
			c: (res, input) => f(input) ? reducer.c(res, input) : res
		}};
	}

	function take(n: number): Transducer {
		return reducer => {
			var l = n;
			return {
				a: reducer.a,
				b: reducer.b,
				c: (res, input) => {
					// TODO: It would be better if this was reduced on the last
					// call like in the original. Find some neat way to do that.
					return l-- > 0 ? reducer.c(res, input) : reduced(res);
				}
			}
		};
	}

	function takeWhile(f: (v: any) => boolean): Transducer {
		return reducer => {
			return {
				a: reducer.a,
				b: reducer.b,
				c: (res, input) => {
					return f(input) ? reducer.c(res, input) : reduced(res);
				}
			}
		};
	}

	function drop(n: number): Transducer {
		return reducer => {
			var l = n;
			return {
				a: reducer.a,
				b: reducer.b,
				c: (res, input) => {
					return (l-- > 0) ? res : reducer.c(res, input);
				}
			}
		};
	}

	function dropWhile(f: (v: any) => boolean): Transducer {
		return reducer => {
			var f2: any = f;
			return {
				a: reducer.a,
				b: reducer.b,
				c: (res, input) => {
					return (f2 && f2(input)) ? res : (f2 = 0, reducer.c(res, input));
				}
			}
		};
	}

	// Concatenate a sequence of collections into one sequence
	function cat(reducer: Reducer): Reducer {
		return {
			a: reducer.a,
			b: reducer.b,
			c: (res, input) => {
				var innerReducer = {
					a: reducer.a,
					b: id,
					c: (res2, input2) => {
						var val = reducer.c(res2, input2);
						return isReduced(val) ? val.v : val;
					}
				}

				return reduce(input, innerReducer, res);
			}
		}
	}

	function mapcat(f): Transducer {
		return compose(map(f), cat);
	}

	function pusher(r: Reducer): (v: any) => boolean {
		var result = r.a();
		return v => {
			result = r.c(result, v);
			return !isReduced(result);
		};
	}

	function wrap(f: (input, res?) => any, init?): Reducer {
		return {
			a: () => init,
			b: id,
			c: f
		};
	}

	function counter(r: Reducer): Reducer {
		var c = 0;
		return {
			a: r.a,
			b: id,
			c: (res, input) => r.c(res, ++c)
		};
	}

	function every10Seconds(): Signal {
		var reducers = [];

		function set() {
			setTimeout(() => {
				reducers = into([], reducers, filter(e => e(1)));
				// TODO: If reducers cannot grow, we can let the signal disappear here
				if (reducers.length || s.then)
					set();
			}, 1000);
		}

		var s = {
			then: r => {
				reducers.push(pusher(r));
			}
		};

		set();

		return s;
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
		pusher: pusher,
		every10Seconds: every10Seconds,
		counter: counter,
		wrap: wrap
	};
})
