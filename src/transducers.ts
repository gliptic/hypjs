
type IteratorResult = { value?: any; done?: boolean };

interface Iterator { next(): IteratorResult; }

declare var Symbol: any;

define(function () {

	/** @const */
	var DEBUG = false;
	/** @const */
	var CHECK_CYCLES = DEBUG || false;
	

	function id(v) {
		return v;
	}

	function nop() {
	}

	function isUndef(x): boolean {
		return x === void 0;
	}

	var arrayReducer: Transducer = s => {
		s = s || [];
		return defaultReducer({ b: () => s },
			v => { s.push(v); })
	};

	var objReducer: Transducer = s => {
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
		return function(r: any) {
			return a(b(r));
		}
	}

	function objBind(coll, f: Reducer) {
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
			return v; // Default to array
	}

	function reduce(coll, reducer: Reducer): any {
		internalReduce(coll, reducer);
		return reducer.b && reducer.b();
	}

	function internalReduce(coll, reducer: Reducer) {
		var c = false;
		if (Array.isArray(coll)) {
			c = coll.some(reducer);
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

	function defaultReducer(reducer, f: Reducer) {
		if (reducer.b) f.b = reducer.b;
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

	function fold(f: (x, y) => any): Transducer {
		return s => {
			var r: Reducer = input => s = f(s, input);
			r.b = () => s;
			return r;
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

	function match(coll): Transducer {
		return reducer => {
			return defaultReducer(reducer, (input) => {
				for (var i = 0; i < coll.length; ++i) {
					var v = coll[i](input);
					if (!isUndef(v)) {
						return reducer(v);
					}
				}
			});
		};
	}

	function process(r: Reducer): Reducer {
		var c = false;
		return v => c || (c = r(v));
	}

	function counter(reducer: Reducer): Reducer {
		var c = 0;
		return defaultReducer(reducer, (input) => reducer([input, ++c]));
	}

	function every(interval: number): Signal {
		var sig = signal();

		function set() {
			setTimeout(() => {
				sig(1) || set();
			}, interval);
		}

		set();

		return sig;
	}

	function delay(ms: number, v?: any): Signal {
		var sig = signal();

		setTimeout(() => {
			sig(v, true);
		}, ms);
		
		return sig;
	}

	// TODO: How do we prevent misuse of these on non-leasing reducers?
	function wait(): Transducer {
		return (reducer: Reducer) => {

			var o = 1, res = signal(true);

			var r: any = {
				b: function () {
					--o || res(reducer.b(), true);
					return res;
				},
				d: function () {
					++o;
					var l = function (val, done?) {
						if ((!isUndef(val) && reducer(val)) || done) {
							--o || res(reducer.b(), true);
							return true;
						}
						return;
					}
					return l;
				}};

			return r;
		};
	}

	function latest(): Transducer {
		return (reducer: Reducer) => {

			var cur = 0;

			var r: any = {
				b: function () {},
				d: function () {
					var me = ++cur;
					return function (val, done?) {
						return me !== cur || (!isUndef(val) && reducer(val)) || done;
					}
				}};

			return r;
		};
	}

	function signal(persistent?: boolean): Signal {
		var subs = [],
			lastValue,
			isDone = false,
			isProcessing = false;

		var sig: any = (val, done?) => {
			if (CHECK_CYCLES) {
				if (isProcessing) {
					throw 'Cyclic';
				}
				isProcessing = true;
			}
			if(persistent) lastValue = val;
			isDone = done;
			subs = subs.filter(s => !s(val, isDone));
			if (CHECK_CYCLES) { isProcessing = false }
			return !subs.length || !sig.then;
		};

		sig.then = (reducer: Reducer) => {
			var lease = reducer.d ?
				reducer.d() :
				function (val, done) { return (!isUndef(val) && reducer(val)) || done; };

			if(!lease(lastValue, isDone)) subs.push(lease);
			return;
		};

		return sig;
	}

	function run(ev: Reducer) {
		return filter(v => !ev(v));
	}
	/*
		return reducer => {
			return defaultReducer(reducer, function (input) {
				return ev(input) || reducer(input);
			});
		};
	}*/

	function to(dest?: Object | any[] | Reducer): Reducer {
		return this(getReducer(dest));
	}

	function onerr(ev: Reducer): Transducer {
		return reducer => {
			return defaultReducer(reducer, function (input) {
				if (input instanceof Error) {
					return ev(input)
				} else {
					return reducer(input);
				}
			});
		};
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
		latest: latest,
		match: match,
		onerr: onerr,
		//fold: fold,
		//to: to
	};

	// Methods on transducers for chaining

	// Mod works like the null transducer.
	// This is a bit dirty. See if there's a better way.
	mod = id;
	objBind(transducerFunctions, v => {
		var innerF = v[1];
		function fluentWrapper() {
			var rhs = innerF.apply(null, arguments),
				lhs = this;
			var td: Transducer = compose(lhs, rhs);
			objBind(transducerFunctions, v2 => { td[v2[0]] = mod[v2[0]] });
			td.to = to;
			return td;
		}

		mod[v[0]] = fluentWrapper;
	});

	objMerge({
			//pipe: pipe,
			//into: into,
			compose: compose,
			
			reducep: reducep,
			reduce: reduce,

			// Signals
			process: process,
			//everySecond: everySecond,
			delay: delay,
			signal: signal,
			//every: every
		}, mod);

	return mod;
})
