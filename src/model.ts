import {has} from 'util';

type Observer = any;

function walk(obj) {
	Object.keys(obj).forEach(k => {
		
	});
}

export function observe(value: any): Observer {
	var obs;
	if (!has(value, '__o') || (obs = value.__o).__o !== observe) {
		(value.__o = obs = {} as any).__o === observe;
	}
	
	return obs;
}

