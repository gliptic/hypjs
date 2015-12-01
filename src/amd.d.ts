declare module Amd {

	export interface Define {
	    (def: (...d: any[]) => any);
	    (deps: string[], def: (...d: any[]) => any);
	    (name: string, deps: string[], def: (...d: any[]) => any);
	    amd: {};
	    // TODO: Should we support (name, def)?
	}

	export interface Require {
	    (def: (...d: any[]) => any);
	    (deps: string[], def: (...d: any[]) => any);
	    (name: string): any;
	    config(conf: { paths: any; error?: any; waitSeconds?: any; baseUrl?: string });
	}

	export const enum Error {
		TimeOut = 0,
		LoadError = 1
	}
}

declare var define: Amd.Define;
declare var require: Amd.Require;
declare var exports: any;
declare var __dirname: string;
