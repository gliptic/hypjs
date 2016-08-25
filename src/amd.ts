/// <reference path="amd.d.ts" />

interface AmdPromise<T> {
    c?: (() => void);
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

(function (g, opt?, err?, modules?: ModuleDict, defPromise?: AmdPromise<RequireContext>) {
    var SUPPORT_SHIMS = true,
        SUPPORT_NODE = false,
        SUPPORT_ABSOLUTE_PATHS = true;

    var DEBUG = false,
        MISUSE_CHECK = DEBUG || false,
        SIMULATE_TIMEOUT = false,
        SIMULATE_RANDOM_404 = false,
        DefaultTimeout = 7;

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

        (resolve as any)(defPromise, rootModule = { c: function () {} }, defPromise = {});
    }

    (g.require = localRequire as Amd.Require).config = function (o) {
        opt = o;
        err = o.error || ((e, name) => { throw errstr(e, name); })
    }

    function errstr(e: Amd.Error, name: string) {
        //return ["Timeout loading ", "Error loading "][e] + (name || '');
        return (e ? "Error loading " : "Timeout loading ") + (name || '');
    }

    modules = {};
    defPromise = {};
    
    function then<T>(m: AmdPromise<T>, f: (m: T) => void, prev?) {
        prev = m.c;
        if (m.a) f(m.a); else m.c = function() { f(m.a); prev && prev() };
        return m;
    }

    function resolve<T>(m: AmdPromise<T>, mobj?: T) {
        if (mobj) m.a = mobj;
        m.c && m.c();
        m.c = null;
    }

    // TODO: Fix conflicts with prototype fields

    function getModule(name: string): Module {
        return modules[name] || (modules[name] = {});
    }

    function requestLoad(name, m?: Module, path?, node?, shim?) {

        // Get path to module
        if (SUPPORT_ABSOLUTE_PATHS) {
            // If name ends in .js, use it as is.
            // Likewise, if paths[name] ends with .js, don't add baseUrl/.js to it.
            if (!/\.js$/.test(path = opt.paths[name] || name))
                path = (opt.baseUrl || '') + path + '.js';
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
                    (resolve as any)(defPromise, m, defPromise = {});
                });
            } else {
                // type = 'text/javascript' is default
                node = document.createElement('script');
                    //.async = true; // TODO: We don't need this in new browsers as it's default.
                node.onload = () => {
                    if (SUPPORT_SHIMS && shim) {
                        localDefine(() => {
                            shim.init && shim.init();
                            return g[shim.exports];
                        });
                    }

                    (resolve as any)(defPromise, m, defPromise = {});
                };
                node.onerror = () => { err(Amd.Error.LoadError, name); };
                node.src = path;

                shim = SUPPORT_SHIMS && opt.shim && opt.shim[name];

                localRequire(shim && shim.deps || [], () => {
                    DEBUG && console.log('Requesting ' + path);

                    if (!SIMULATE_TIMEOUT) {
                        document.head.appendChild(node);
                    } else if (Math.random() < 0.3) {
                        setTimeout(function () { document.head.appendChild(node) }, (opt.waitSeconds || DefaultTimeout) * 1000 * 2);
                    }
                });
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
                    (then as any)(requestLoad(depName), dec, ++depsLeft);
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

})(this)