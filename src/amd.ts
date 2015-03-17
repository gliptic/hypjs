interface Define {
    (def: (...d: any[]) => any);
    (deps: string[], def: (...d: any[]) => any);
    (name: string, deps: string[], def: (...d: any[]) => any);
    // TODO: Should we support (name, def)?
}

interface Require {
    (def: (...d: any[]) => any);
    (deps: string[], def: (...d: any[]) => any);
    config(conf: { paths: any });
}

interface Promise<T> {
    c?: ((m: T) => void)[];
    v?: any;
}

interface Module extends Promise<any> {
    n?: string;
}

interface ModuleDict {
    [name: string]: Module;
    exports?: any;
}

interface RequireContext extends Promise<void> {
    n?: number;
    s?: Module; // The single anonymous module for this context. This is set in onload.
    t?: number;
}

declare var define: Define;
declare var require: Require;

(function (global) {
    /** @const */
    var DEBUG = false;
    /** @const */
    var MISUSE_CHECK = false;
    /** @const */
    var SIMULATE_TIMEOUT = false;
    /** @const */
    var SIMULATE_RANDOM_404 = false;
    /** @const */
    var DefaultTimeout = 7;

    // tsc still outputs lots of crap for enums so we'll have to make do with this.
    /** @const */
    var TimeOut = 0;
    /** @const */
    var LoadError = 1;

    global.require = function (deps?: any, def?: (...d: any[]) => any) {
        global.define(deps, def);

        // There may be defines that haven't been processed here because they were
        // made outside a 'require' context. Those will automatically tag along into
        // this new context.
        var ctx: RequireContext = {
            c: [],
            n: 0,
            s: {},
            t: setTimeout(() => {
                if (ctx.c) { // If we haven't resolved the context yet...
                    // Time-out
                    ctx.n = 0/1; // Make sure the context is never resolved
                    err(TimeOut);
                }
            }, (conf.waitSeconds || DefaultTimeout)*1000) };

        flushDefines(ctx);
    }

    function errstr(e) {
        return ["Timeout loading module", "Error loading module"][e];
    }

    global.require.config = function (c) {
        conf = c;
        err = c.error || (e => { throw errstr(e); });
    }

    var head = document.getElementsByTagName('head')[0],
        modules: ModuleDict = { require: { v: global.require } },
        defPromise: Promise<RequireContext> = { c: [] },
        requested = {},
        conf,
        err;

    function then<T>(m: Promise<T>, f: (m: T, ctx?: any) => void) {
        // We use unshift so that we can use a promise for post-order traversal too
        !m.c ? f(m.v) : m.c.unshift(f);
    }

    function resolve<T>(m: Promise<T>, mobj?: T) {
        if (m.c) { // Only resolve once
            m.c.map(cb => cb(mobj));
            m.c = null;
            m.v = mobj;
        }
    }

    function checkContextDone(ctx: RequireContext) {
        if (!ctx.n) {
            DEBUG && console.log('Resolving context');
            resolve(ctx);
        }
    }

    function flushDefines(ctx?: RequireContext) {
        DEBUG && console.log('Flusing defines');
        resolve(defPromise, ctx);
        defPromise = { c: [] };
    }

    function getPath(name: string): string {
        return (conf.baseUrl || '') + (conf.paths[name] || name) + '.js';
    }

    function getModule(name: string): Module {
        return modules[name] || (modules[name] = { n: name, c: []});
    }

    function requestLoad(name, mod, ctx) {
        var m: Module,
            path = getPath(name),
            existing = modules[name];

        if (name == 'exports') {
            m = { v: {} };
            resolve(mod, m.v);
        } else {
            m = getModule(name);

            DEBUG && console.log('Looking for ' + name + ', found ' + m)

            if (!existing && !requested[path]) { // Not yet loaded
                ++ctx.n;

                requested[path] = true;

                DEBUG && console.log('Requesting ' + path);

                if (SIMULATE_RANDOM_404 && Math.random() < 0.3) {
                    path += '_spam';
                }
                
                // type = 'text/javascript' is default
                var node = document.createElement('script');
                node.async = true; // TODO: We don't need this in new browsers as it's default.
                node.src = path;
                node.onload = () => { ctx.s = m; flushDefines(ctx); --ctx.n; checkContextDone(ctx); };
                node.onerror = () => { ctx.n = 0/1; err(LoadError, m.n); };

                if (!SIMULATE_TIMEOUT) {
                    head.appendChild(node);
                } else if (Math.random() < 0.3) {
                    setTimeout(function () { head.appendChild(node) }, (conf.waitSeconds || DefaultTimeout) * 1000 * 2);
                }
            }
        }

        return m;
    }
    
    global.define = function(name: any, deps?: any, def?: (...d: any[]) => any) {
        var mod: Module;
        if (def) {
            mod = getModule(name);
        } else {
            def = deps;
            deps = name;
            if (!def) {
                def = deps;
                deps = [];
            }
        }

        DEBUG && console.log('Schedule define called ' + name);
        then(defPromise, ctx => {
            if (!mod) { mod = ctx.s; ctx.s = null; }

            if (MISUSE_CHECK && !mod) throw 'Ambiguous anonymous module';

            var depPromises = deps.map(depName => requestLoad(depName, mod, ctx));

            then(ctx, () => {
                resolve(mod, def.apply(null, depPromises.map(p => {
                    if (MISUSE_CHECK && !p.v) throw 'Unresolved cyclic reference of ' + p.n;
                    return p.v;
                })));
            });
            checkContextDone(ctx); // We need to do this here in case ctx.n wasn't changed at all
        });
    }

})(this)