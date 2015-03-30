declare module "render" {
	export function render(oldDom: any[], newDom: any[], parentNode: Element);
	export function root(node);
}