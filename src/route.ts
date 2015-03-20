import td = require('transducers');

interface Route {
	(path: string): any;
	s?: Signal;
	p?: any[];
	m?: RegExp;
}

var queryStringMatcher = /\?([^#]*)?$/,
	routes: Route[] = [];

function router(path: any): Signal {
	var paramNames = [];
	if (typeof path == 'string') {
		var paramR = /:([\w\d]+)/g,
			pathMatch;

		while (pathMatch = paramR.exec(path)) {
	  		paramNames.push(pathMatch[1]);
	    }

	    path = new RegExp(path.replace(paramR, "([^\/]+)") + "$");
	}

	var s = td.signal();

	routes.push(p => {
		var parts;
		if (parts = p.match(path)) {
			var params = {};
			parts.some((part, index) => {
				params[paramNames[index]] = part;
			});
			s([params]);
			return true;
		}	
	});

	return s;
}

function matchRoute(path) {
	routes.some(route => route(path));
}

var lastLocs = [];

function getLocation() {
	return location.hash;
}

function checkLocation() {
	var curLoc = getLocation();
	if (!lastLocs.some(v => v == curLoc)) {
		lastLocs = [curLoc];
		matchRoute(curLoc);
	}
}

function start() {
	window.onhashchange = checkLocation;
	checkLocation();
}

function reload() {
	lastLocs = [];
	checkLocation();
}

function go(path) {
	lastLocs.push(path); // Make sure no event triggers
	location.hash = path;
	checkLocation();
}

(<any>router).start = start;
(<any>router).reload = reload;
(<any>router).go = go;

//td.every(1000).then(checkLocation);
//setInterval(1000, checkLocation);

export = router;