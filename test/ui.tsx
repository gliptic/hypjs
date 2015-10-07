/// <reference path="../src/render2.d.ts" />

import * as render from 'render2';
import * as _ from 'transducers';
import * as bench from 'bench';
import * as legacy from 'legacy';

console.log(legacy.x);

var empty = {};
var React = {
	createElement: function (tag, props, ...body) {
		// Flatten body
		for (var i = 0; i < body.length; i++) {
			if (Array.isArray(body[i])) {
				body = body.concat.apply([], body);
				i--;
			}
		}

		props = props || empty;

		var n;

		if (typeof tag === 'string') {
			n = {
				t: tag,
				a: props,
				c: body
			}
		} else {
			n = tag(props, body);
		}

		n.key = props.key;
		return n;
	}
}

var v: number;

function Boo(props: any[], body) {
	function click() {
		console.log('ok');
	}
	return <div class="x" key="1">
			<div onclick={click}>Hello</div>
		</div>;
}

var x = <Boo />;

export function show(node) {
	var ctx = render.root(node);
	return () => { ctx([x]) };
}

/*
var getMask = 0, dirtyMask = 0;

var obj1: any = _(_.range(1000)).map(v => {
	var o = { x_: 0, y_: 0 };
	Object.defineProperty(o, 'x', {
		get: () => { getMask |= 1; return this.x_; },
		set: val => {
			dirtyMask |= 1;
			this.x_ = val;
		}
	});

	Object.defineProperty(o, 'y', {
		get: () => { getMask |= 2; return this.y_; },
		set: val => {
			dirtyMask |= 2;
			this.y_ = val;
		}
	});
	return o;
}).to([]);

var obj2: any = _(_.range(1000)).map(v => { return { x: 0, y: 0 } }).to([]);

var obj3: any = _(_.range(1000)).map(v => {
	return {
		x: function(val) {
			if (arguments.length) {
				dirtyMask |= 1;
				this.x_ = val;
			} else {
				getMask |= 1;
				return this.x_;
			}
		},
		y: function(val) {
			if (arguments.length) {
				dirtyMask |= 1;
				this.y_ = val;
			} else {
				getMask |= 1;
				return this.y_;
			}
		}
	}
}).to([]);

function loop1(): number {
	getMask = 0;
	dirtyMask = 0;

	var sum = 0;

	for (var i = 0; i < 1000; ++i) {
		obj1[i].x = i;
		obj1[i].y = i;
	}

	for (var i = 0; i < 1000; ++i) {
		sum += obj1[i].x + obj1[i].y;
	}

	return sum;
}

function loop2(): number {
	getMask = 0;
	dirtyMask = 0;

	var sum = 0;

	for (var i = 0; i < 1000; ++i) {
		dirtyMask |= 1;
		obj2[i].x = i;
		dirtyMask |= 2;
		obj2[i].y = i;
	}

	for (var i = 0; i < 1000; ++i) {
		getMask |= 1;
		getMask |= 2;
		sum += obj2[i].x + obj2[i].y;
	}

	
	return sum;
}

function loop3(): number {
	getMask = 0;
	dirtyMask = 0;

	var sum = 0;

	for (var i = 0; i < 1000; ++i) {
		obj3[i].x(i);
		obj3[i].y(i);
	}

	for (var i = 0; i < 1000; ++i) {
		sum += obj3[i].x() + obj3[i].y();
	}

	return sum;
}

bench.bench('defineProperty', loop1);
bench.bench('direct', loop2);
bench.bench('funcs', loop3);
bench.run();
*/