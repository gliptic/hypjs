interface IteratorResult<T> {
	value?: T;
	done?: boolean;
}

interface Iterator<T> { next(): IteratorResult<T>; }

interface Reducer<T, R> {
	(input: T): any; // step
	b?: (endcond?) => R; // result
}

interface Unspool<T> {
	next?: () => IteratorResult<T>;
	some?: (r: Reducer<T, any>) => any; // Extract rest into r
	b?: (rest?: boolean) => any; // End, optionally returning rest
}

interface Transducer<I, O> {
	<R>(r: Reducer<O, R>): Reducer<I, R>;
	b?: (endcond?) => any;
}

interface TransducerObj<I, O> {
	f: Transducer<I, O>;
	map<O2>(f: (v: O) => O2): TransducerObj<I, O2>;
	filter(f: (v: O) => boolean): TransducerObj<I, O>;
	take(n: number): TransducerObj<I, O>;
	takeWhile(f: (v: O) => boolean): TransducerObj<I, O>;
	drop(n: number): TransducerObj<I, O>;
	dropWhile(f: (v: O) => boolean): TransducerObj<I, O>;
	cat(join?): TransducerObj<I, any>;
	mapcat(f: (v: O) => any, join?): TransducerObj<I, any>;
	match<O2>(coll: ((v: O) => O2)[]): TransducerObj<I, O2>;
	fold<A, B>(f: (x: A, y: B) => A, s: A): Reducer<B, A>;
	groupBy<T>(f: (x: T) => any): TransducerObj<T, T>;

	to<R>(reducer: Reducer<O, R>): Reducer<O, R>;
	to<R>(init: R): Reducer<O, R>;
	to(init?): Reducer<I, any>;
	timegaps(): TransducerObj<I, { v: O; interval: number }>;
	done<T>(ev: Reducer<T, any>): TransducerObj<T, T>;
	err<T>(ev: Reducer<any, any>): TransducerObj<T, T>;

	comp<T>(td: TransducerObj<O, T>): TransducerObj<I, T>;
}

interface Eduction<C, I, O> {
	c: C;
	f: Transducer<I, O>;
	map<T>(f: (v: O) => T): Eduction<C, I, T>;
	filter(f: (v: O) => boolean): Eduction<C, I, O>;
	take(n: number): Eduction<C, I, O>;
	takeWhile(f: (v: O) => boolean): Eduction<C, I, O>;
	drop(n: number): Eduction<C, I, O>;
	dropWhile(f: (v: O) => boolean): Eduction<C, I, O>;
	cat(join?): Eduction<C, I, any>;
	mapcat(f: (v: O) => any, join?): Eduction<C, I, any>;
	match<O2>(coll: ((v: O) => O2)[]): Eduction<C, I, O2>;
	groupBy<T>(f: (x: T) => any): Eduction<C, T, T>;

	fold<A, B>(f: (x: A, y: B) => A, s: A): Reducer<B, A>;
	to<R>(reducer: Reducer<O, R>): R;
	to<R>(init: R): R;
	to(init?): any;
	lazy(): Unspool<O>;
	timegaps(): Eduction<C, I, { v: O; interval: number }>;
	done<T>(ev: Reducer<T, any>): Eduction<C, T, T>;
	err<T>(ev: Reducer<any, any>): Eduction<C, T, T>;

	comp<T>(td: TransducerObj<O, T>): Eduction<C, I, T>;
}

interface Signal<T> extends Eduction<Signal<T>, T, T> {
	r?: Reducer<T, void>;
	some(r: Reducer<T, any>): any;
	cur(): T;
}

declare module "transducers" {
	function TransducerModule<C>(coll: C): Eduction<C, any, any>;

	module TransducerModule {
		export function map<I, O>(f: (v: I) => O): TransducerObj<I, O>;
		export function filter<T>(f: (v: T) => boolean): TransducerObj<T, T>;
		export function take<T>(n: number): TransducerObj<T, T>;
		export function takeWhile<T>(f: (v: T) => boolean): TransducerObj<T, T>;
		export function drop(n: number): TransducerObj<any, any>;
		export function dropWhile<T>(f: (v: T) => boolean): TransducerObj<T, T>;
		export function cat(): TransducerObj<any, any>;
		export function mapcat<I>(f: (v: I) => any): TransducerObj<I, any>;
		export function match<I, O>(coll: ((v: I) => O)[]): TransducerObj<I, O>;
		export function fold<A, B>(f: (x: A, y: B) => A, s: A): Reducer<B, A>;
		export function groupBy<T>(f: (x: T) => any): TransducerObj<T, T>;

		export function latest(): <I, O>(next: Transducer<I, O>) => Transducer<I, O>;

		export function sig<T>(persistent?: boolean): Signal<T>;
		export function every(interval: number): Signal<number>;
		export function after<T>(interval: number, v?: T): Signal<T>;
	}

	export = TransducerModule
}