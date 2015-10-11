/// <reference path="amd.d.ts" />

interface AmdPromise<T> {
    c?: ((m: T) => void)[];
    a?: any;
}

interface Module extends AmdPromise<any> {
    b?: boolean; // Whether this module was used in an anonymous context already
}

interface ModuleDict {
    [name: string]: Module;
    exports?: any;
    require?: any;

}

interface RequireContext extends Module {
    
}

(function (g) {
    var SUPPORT_SHIMS = true;
    var SUPPORT_NODE = false;
    var SUPPORT_ABSOLUTE_PATHS = true;

    var DEBUG = false;
    var MISUSE_CHECK = DEBUG || false;
    var SIMULATE_TIMEOUT = false;
    var SIMULATE_RANDOM_404 = false;
    var DefaultTimeout = 7;

    var isNode = SUPPORT_NODE && typeof window == 'undefined';
    if (isNode) {
        g = exports;
    }

    function localRequire(deps?: any, def?: (...d: any[]) => any, rootModule?) {
        if (isNode && !def) return localRequire(deps);
        localDefine(deps, def);

        // There may be defines that haven't been processed here because they were
        // made outside a 'require' context. Those will automatically tag along into
        // this new context.

        setTimeout(() => {
            if (rootModule.c) { // If we haven't resolved the context yet...
                // Time-out
                err(Amd.Error.TimeOut);
            }
        }, (opt.waitSeconds || DefaultTimeout)*1000);

        flushDefines(rootModule = { c: [] });
    }

    (<any>localRequire).config = function (o) {
        opt = o;
        err = o.error || ((e, name) => { throw errstr(e, name); })
    }

    function errstr(e: Amd.Error, name: string) {
        return ["Timeout loading ", "Error loading "][e] + (name || '');
    }

    var opt,
        err,
        modules: ModuleDict = {},
        defPromise: AmdPromise<RequireContext> = { c: [] };

    function then<T>(m: AmdPromise<T>, f: (m: T) => void) {
        if (m.a) f(m.a); else m.c.push(f);
        return m;
    }

    function resolve<T>(m: AmdPromise<T>, mobj?: T) {
        if (m.c) { // Only resolve once
            if (mobj) m.a = mobj;
            m.c.map(cb => cb(mobj)); // .map is not ideal here, but we lose at least 7 bytes switching to something else!
            m.c = null;
        }
    }

    function flushDefines(ctx, temp?) {
        if (MISUSE_CHECK && defPromise.c.length == 0) throw 'Expected shim or define() in loaded file';
        DEBUG && console.log('Flushing defines. ' + defPromise.c.length + ' defines waiting.');
        temp = defPromise;
        defPromise = { c: [] };
        resolve(temp, ctx);
        //temp = defPromise.c;
        //defPromise.c = [];
        //temp.map(cb => cb(ctx));
    }

    // TODO: Fix conflicts with prototype fields

    function getModule(name: string): Module {
        return modules[name] || (modules[name] = { c: [] });
    }

    function requestLoad(name, m?: Module, path?, node?, shim?, existing?) {
        function load() {

            DEBUG && console.log('Requesting ' + path);

            // type = 'text/javascript' is default
            (node = document.createElement('script'))
                .async = true; // TODO: We don't need this in new browsers as it's default.
            node.onload = () => {
                //ctx.b = m;
                if (SUPPORT_SHIMS && shim) {
                    localDefine(() => {
                        shim.init && shim.init();
                        return shim.exports && g[shim.exports];
                    });
                }
                flushDefines(m);
            };
            node.onerror = () => { err(Amd.Error.LoadError, name); };
            node.src = path;

            if (!SIMULATE_TIMEOUT) {
                document.head.appendChild(node);
            } else if (Math.random() < 0.3) {
                setTimeout(function () { document.head.appendChild(node) }, (opt.waitSeconds || DefaultTimeout) * 1000 * 2);
            }
        }

        // Get path to module
        if (SUPPORT_ABSOLUTE_PATHS) {
            // If name ends in .js, use it as is.
            // Likewise, if paths[name] ends with .js, don't add baseUrl/.js to it.
            path = opt.paths[name] || name;
            path = /\.js$/.test(path) ? path : (opt.baseUrl || '') + path + '.js';
        } else {
            path = (opt.baseUrl || '') + (opt.paths[name] || name) + '.js';
        }

        if (!modules[name] && !(requestLoad as any)[path]) {
            // Not yet loaded
            (requestLoad as any)[path] = path;

            if (SIMULATE_RANDOM_404 && Math.random() < 0.3) {
                path += '_spam';
            }

            if (isNode) {
                (<any>require)('fs').readFile(__dirname + '/' + path, function (err, code) {
                    (<any>require)('vm').runInThisContext(code, { filename: path });
                    //ctx.b = m;
                    flushDefines(m);
                });
            } else if (SUPPORT_SHIMS && (shim = opt.shim[name])) {
                localRequire(shim.deps || [], load);
            } else {
                load();
            }
            
        }

        m = getModule(name);

        DEBUG && console.log('Looking for ' + name + ', found', m)

        return m;
    }

    function localDefine(name: any, deps?: any, def?: (...d: any[]) => any, mod?) {

        /* This also allows define(name, def) ...
        if ('' + name === name) {
            mod = getModule(name);
        } else {
            def = deps;
            deps = name;
            name = null;
        }

        if (!Array.isArray(deps)) {
            def = deps;
            deps = [];
        }
        */

        if (def) {
            mod = getModule(name);
        } else {
            def = deps;
            deps = name;
            name = null;
            if (!def) {
                def = deps;
                deps = [];
            }
        }

        if (MISUSE_CHECK) {
            if (name && typeof name !== 'string') throw 'name must be a string';
            if (!Array.isArray(deps)) throw 'dependencies must be an array';
            if (typeof def !== 'function') throw 'definition must be a function';
        }

        DEBUG && console.log('Schedule define called ' + name + ' with deps: ' + deps);

        then(defPromise, (ctx, depPromises?, depsLeft?) => {

            depsLeft = 1;
            if (!mod) { (mod = !ctx.b && ctx).b = true; }

            DEBUG && console.log('Executing define for ' + Object.keys(modules).filter(x => modules[x] === mod));

            if (MISUSE_CHECK && !mod) throw 'Ambiguous anonymous module';

            depPromises = deps.map(depName => {
                return depName == 'exports' ? (mod.a = {}, mod)
                    : depName == 'require' ? { a: localRequire } :
                    (<any>then)(requestLoad(depName), dec, ++depsLeft);
            });

            DEBUG && console.log('All deps requested');

            function dec() {
                if (!--depsLeft) {
                    DEBUG && console.log('Executing body for ' + Object.keys(modules).filter(x => modules[x] === mod));
                    resolve(mod, def.apply(g, depPromises.map(p => p.a)));
                }

                DEBUG && console.log('Dep loaded for ' + Object.keys(modules).filter(x => modules[x] === mod) + ', ' + depsLeft + ' to go.');
            }

            dec();
        });
    }

    (define = localDefine as Amd.Define).amd = {};
    g.require = localRequire as Amd.Require;

})(this)