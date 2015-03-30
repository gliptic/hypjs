

declare module "route" {
	function RouteModule(pattern: string, r: Reducer<Object, any>): (path: string) => RouteMatchResult;

	module RouteModule {
		export var url: Signal<string>;
	}

	export = RouteModule	
}