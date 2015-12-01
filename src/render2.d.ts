declare module "render2" {
	export function render(oldDom: any[], newDom: any[], parentNode: Element);
	export function root(node);
	export var React: any;
}