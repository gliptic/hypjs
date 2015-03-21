import td = require('transducers');

interface Route {
	(path: string): () => any;
	s?: Signal;
	p?: any[];
	m?: RegExp;
}

var queryStringMatcher = /\?([^#]*)?$/;

type RouteMatchResult = void | (() => void);

function route(path: any, dest: Reducer): (path: string) => RouteMatchResult {
	var paramNames = [];

	var paramR = /[:\*]([\w\d]*)/g,
		pathMatch;

	for (; pathMatch = paramR.exec(path); ) {
  		paramNames.push(pathMatch[1]);
    }

    path = new RegExp(path.replace(paramR, str => {
    	return str[0] == ':' ? "([^\/]+)" : "(.+)";
	}) + "$");

	return p => {
		var parts;
		if (parts = p.match(path)) {
			var params = {};
			parts.some((part, index) => {
				params[paramNames[index]] = part;
			});

			return function () {
				dest(params);
			};
		}
	};
}

var lastLocs = [];

var url = td.signal(true);

function getLocation() {
	return location.hash;
}

function checkLocation() {
	var curLoc = getLocation();
	if (!lastLocs.some(v => v == curLoc)) {
		lastLocs = [curLoc];
		url(curLoc);
	}
}

window.onhashchange = checkLocation;
checkLocation();

function ready(f) {
	function check() {
		document.onreadystatechange = check;
	    if (/plete|loaded|ractive/.test(document.readyState)) {
	        f && f();
	        f = null;
	    }
	}

    check();
}

function reload() {
	lastLocs = [];
	checkLocation();
}

function go(path) {
	lastLocs.push(path); // Make sure no event triggers. We're going to trigger it manually.
	location.hash = path;
	checkLocation();
}

(<any>route).url = url;
(<any>route).reload = reload;
(<any>route).go = go;
(<any>route).ready = ready;

export = route;