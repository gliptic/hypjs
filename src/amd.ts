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
    n: number;
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
    var default_timeout = 7;

    global.require = <any>function (deps?: any, def?: (...d: any[]) => any) {
        global.define(deps, def);

        // There may be defines that haven't been processed here because they were
        // made outside a 'require' context. Those will automatically tag along into
        // this new context.
        var ctx: RequireContext = { c: [], n: 0, s: {} };
        flushDefines(ctx);


        ctx.t = setTimeout(function () {
            var n = ctx.n;
            ctx.n = -1/0; // Make sure the context is never resolved
            throw 'Timeout loading ' + n + ' modules';
        }, (conf.waitSeconds || default_timeout)*1000)
    }

    global.require.config = function (c) {
        conf = c;
    }

    var head = document.getElementsByTagName('head')[0],
        modules: ModuleDict = { require: { v: global.require } },
        defPromise: Promise<RequireContext> = { c: [] },
        requested = {},
        conf;

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

    function depDone(ctx: RequireContext) {
        if (!ctx.n) {
            clearTimeout(ctx.t);
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
        var path = conf.paths[name] || name;
        return (conf.baseUrl || '')
             + path
             + (/\.js$/.test(path) ? '' : '.js'); // Auto-add .js if missing
    }

    function getModule(name: string): Module {
        return modules[name] || (modules[name] = { n: name, c: []});
    }

    function requestLoad(name, mod, ctx) {
        var m: Module,
            path = getPath(name),
            existed;

        if (name == 'exports') {
            m = { v: {} };
            resolve(mod, m.v);
            return m;
        } else {
            existed = modules[name];
            m = getModule(name);
        }

        DEBUG && console.log('Looking for ' + name + ', found ' + m)

        if (!existed && !requested[path]) { // Not yet loaded
            ++ctx.n;

            requested[path] = true;

            DEBUG && console.log('Requesting ' + path);

            if (SIMULATE_RANDOM_404 && Math.random() < 0.3) {
                path += '_spam';
            }
            
            // type = 'text/javascript' is default
            var node = document.createElement('script');
            node.async = true;
            node.src = path;
            node.onload = function () { ctx.s = m; flushDefines(ctx); --ctx.n; depDone(ctx); };
            node.onerror = function () { clearTimeout(ctx.t); throw 'Error loading ' + m.n; };

            if (!SIMULATE_TIMEOUT) {
                head.appendChild(node)
            } else {
                setTimeout(function () { head.appendChild(node) }, (conf.waitSeconds || default_timeout) * 1000 * 2);
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
            depDone(ctx);
        });
    }

})(this)