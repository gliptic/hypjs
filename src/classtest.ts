

define(function () {

	/** @const */
	var CLASSES = true;

	if (CLASSES) {

		function transducer(ctor, override) {
			var proto = Object.create(BaseTransducer.prototype, override);

			return function(args) {
				return reducer => {
					var v = Object.create(proto, { r: reducer });
					ctor.apply(v, args);
					return v;
				}
			};
		}

		function BaseTransducer() {
			this.b = function() { return this.r.b() };
		}

		function objBind(coll, f) {
			return Object.keys(coll).some(k => <any>f.s([k, coll[k]]));
		}

		function objMerge(src, dest) {
			if (Array.isArray(src)) {
				dest[src[0]] = src[1];
			} else {
				objBind(src, { a: v => objMerge(v, dest) });
			}
		}

		var arrayReducer = transducer(
			function () { this.r = this.r || [] },
			{ a: function (input) { this.r.push(input); },
			  b: function () { return this.r } });

		var objReducer = transducer(
			function () { this.r = this.r || {} },
			{ a: function (input) { objMerge(input, this.r); },
			  b: function () { return this.r } });

		function storeF(f) { this.f = f; }

		var map = transducer(
			storeF,
			{ a: function (input) { return this.r(this.f(input)); }});

		var filter = transducer(
			storeF,
			{ a: function (input) { return this.f(input) && this.r(input); }});

		var take = transducer(
			storeF,
			{ a: function (input) { return --this.f < 0 || this.r(input) || !this.f; }});

		var drop = transducer(
			storeF,
			{ a: function (input) { return --this.f < 0 && this.r(input); }});

		var takeWhile = transducer(
			storeF,
			{ a: function (input) { return !this.f(input) || this.r(input); }});

		var dropWhile = transducer(
			storeF,
			{ a: function (input) { return !this.f || !this.f(input) && (this.f = 0, this.r(input)) }});

		return {
			map: map,
			filter: filter,
			take: take,
			drop: drop,
			takeWhile: takeWhile,
			dropWhile: dropWhile,
			arrayReducer: arrayReducer,
			objReducer: objReducer
		};
	} else {

		function objBind2(coll, f) {
			return Object.keys(coll).some(k => <any>f([k, coll[k]]));
		}

		function objMerge2(src, dest) {
			if (Array.isArray(src)) {
				dest[src[0]] = src[1];
			} else {
				objBind2(src, v => objMerge2(v, dest));
			}
		}

		var arrayReducer2 = s => {
			s = s || [];
			return defaultReducer({ b: () => s },
				v => { s.push(v); })
		};

		var objReducer2 = s => {
			s = s || {};
			return defaultReducer({ b: () => s },
				v => objMerge2(v, s));
		};

		function defaultReducer(reducer, f: Reducer) {
			if (reducer.b) f.b = reducer.b;
			return f;
		}

		function map2(f: (v: any) => any): Transducer {
			return reducer => {
				return defaultReducer(reducer, (input) => { return reducer(f(input)); });
			};
		}

		function filter2(f: (v: any) => boolean): Transducer {
			return reducer => {
				return defaultReducer(reducer, (input) => { return f(input) && reducer(input); });
			};
		}

		function take2(n: number): Transducer {
			return reducer => {
				var l = n;
				return defaultReducer(reducer, (input) => {
					return --l < 0 || reducer(input) || !l;
				});
			};
		}

		function drop2(n: number): Transducer {
			return reducer => {
				var l = n;
				return defaultReducer(reducer, (input) => {
					return --l < 0 && reducer(input);
				});
			};
		}

		function takeWhile2(f: (v: any) => boolean): Transducer {
			return reducer => {
				return defaultReducer(reducer, (input) => {
					return !f(input) || reducer(input);
				});
			};
		}

		function dropWhile2(f: (v: any) => boolean): Transducer {
			return reducer => {
				var f2: any = f;
				return defaultReducer(reducer, (input) => {
					return !f2 || !f2(input) && (f2 = 0, reducer(input));
				});
			};
		}

		return {
			map: map2,
			filter: filter2,
			take: take2,
			drop: drop2,
			takeWhile: takeWhile2,
			dropWhile: dropWhile2,
			arrayReducer: arrayReducer2,
			objReducer: objReducer2
		};
	}	
});

