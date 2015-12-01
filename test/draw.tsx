import * as render from 'render2';

export function show(node) {
	var ctx = render.root(node);
	return () => { ctx([]) };
}

