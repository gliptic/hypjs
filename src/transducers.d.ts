interface Reducer<T> {
	(input: T, lease?): any; // step
	b?: (endcond?) => any; // result
	d?: (cancel?) => Reducer<T>;
}

interface Transducer<I, O> {
	(r: Reducer<O>): Reducer<I>;
	b?: () => any;
	map?: <O2>(f: (v: O) => O2) => Transducer<I, O2>;
	filter?: (f: (v: O) => boolean) => Transducer<I, O>;
	take?: (n: number) => Transducer<I, O>;
	takeWhile?: (f: (v: O) => boolean) => Transducer<I, O>;
	drop?: (n: number) => Transducer<I, O>;
	dropWhile?: (f: (v: O) => boolean) => Transducer<I, O>;
	cat?: () => Transducer<I, any>;
	mapcat?: (f: (v: O) => any) => Transducer<I, any>;
	match?: <O2>(coll: ((v: O) => O2)[]) => Transducer<I, O2>;
	to?: (init?) => Reducer<any>;
}

interface Signal<T> {
	(val: T, done?: boolean): boolean;
	then(r: Reducer<T>): any;
}

declare module "transducers" {
	export function compose<A, B, C>(a: Transducer<A, B>, b: Transducer<B, C>): Transducer<A, C>;
	export function map<I, O>(f: (v: I) => O): Transducer<I, O>;
	export function filter<T>(f: (v: T) => boolean): Transducer<T, T>;
	export function take<T>(n: number): Transducer<T, T>;
	export function takeWhile<T>(f: (v: T) => boolean): Transducer<T, T>;
	export function drop(n: number): Transducer<any, any>;
	export function dropWhile<T>(f: (v: T) => boolean): Transducer<T, T>;
	export function cat(): Transducer<any, any>; //r: Reducer<any>): Reducer<any>;
	export function mapcat<I>(f: (v: I) => any): Transducer<I, any>;
	export function match<I, O>(coll: ((v: I) => O)[]): Transducer<I, O>;

	export function sig<T>(persistent?: boolean): Signal<T>;
	export function every(interval: number): Signal<number>;

	export function reduce<T>(coll: T[], reducer: (x: T) => boolean): any;
	export function reduce<T>(coll: T[], reducer: Reducer<T>): any;
	export function reduce(coll: any, reducer: Reducer<any>): any;
}