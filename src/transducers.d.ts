interface Reducer {
	(input: any): any; // step
	b?: () => any; // result
	d?: (diff) => void;
}

interface Transducer {
	(t: any): Reducer;
	pipe?: <T>(coll, xform: Transducer, init?: T) => T;
	map?: (f: (v: any) => any) => Transducer;
	filter?: (f: (v: any) => boolean) => Transducer;
	take?: (n: number) => Transducer;
	takeWhile?: (f: (v: any) => boolean) => Transducer;
	drop?: (n: number) => Transducer;
	dropWhile?: (f: (v: any) => boolean) => Transducer;
	cat?: () => Transducer;
	mapcat?: (f: (v: any) => any) => Transducer;
	match?: (coll) => Transducer;
	to?: (init?) => Reducer;
}

interface Signal {
	(vals: any, done?: boolean): boolean;
	then(r: Reducer): any;
}

declare module "transducers" {
	export function compose(...p: Transducer[]): Transducer;
	export function pipe<T>(coll, xform: Transducer, init?: T): T;
	export function map(f: (v: any) => any): Transducer;
	export function filter(f: (v: any) => boolean): Transducer;
	export function take(n: number): Transducer;
	export function takeWhile(f: (v: any) => boolean): Transducer;
	export function drop(n: number): Transducer;
	export function dropWhile(f: (v: any) => boolean): Transducer;
	export function cat(r: Reducer): Reducer;
	export function mapcat(f: (v: any) => any): Transducer;
	export function match(coll): Transducer;

	export function signal(persistent?: boolean): Signal;
	export function every(interval: number): Signal;

	export function reduce<T>(coll: T[], reducer: (x: T) => boolean): any;
	export function reduce(coll, reducer: Reducer): any;
}