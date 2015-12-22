/// <reference path="transducers.d.ts" />
/// <reference path="amd.d.ts" />

type RouteMatchResult = void | (() => void);

define(['transducers'], function (_) {

    function route(path: any, dest: Reducer<Object, any>): (path: string) => RouteMatchResult {
        var paramNames = [];

        var paramR = /[:\*]([\w\d]*)/g,
            pathMatch;

        for (; pathMatch = paramR.exec(path); ) {
            paramNames.push(pathMatch[1]);
        }

        path = RegExp(path.replace(paramR, str => {
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

    var lastLocs = [],
        url = _.sig(true),
        prefixLen = 1;

    function getLocation() {
        return location.hash.slice(prefixLen);
    }

    function checkLocation() {
        var curLoc = getLocation();
        if (!lastLocs.some(v => v == curLoc)) {
            lastLocs = [curLoc];
            url.r(curLoc);
        }
    }

    onhashchange = checkLocation;
    checkLocation();

    function ready(f) {
        function check() {
            document.onreadystatechange = check;
            if (/plete|loade|ractive/.test(document.readyState)) {
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

    return route;
});