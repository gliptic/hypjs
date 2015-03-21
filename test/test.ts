/// <reference path="../src/transducers.d.ts" />

import third = require('transducers')

console.log('Running test.js');

export function foo() {
	return third.map(x => x + 1);
}
