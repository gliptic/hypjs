var hasOwnProperty = Object.prototype.hasOwnProperty;

export function has(obj: Object, key: string): boolean {
	return hasOwnProperty.call(obj, key);
}