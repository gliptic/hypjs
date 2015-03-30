interface Define {
    (def: (...d: any[]) => any);
    (deps: string[], def: (...d: any[]) => any);
    (name: string, deps: string[], def: (...d: any[]) => any);
    amd: boolean;
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
    d?: number;
    callback?: () => void;
}

interface ModuleDict {
    [name: string]: Module;
    exports?: any;
    require?: any;
}

interface RequireContext extends Module {
    s?: Module; // The single anonymous module for this context. This is set in onload.
}

declare var define: Define;
declare var require: Require;

(function (global) {
    /** @const */
    var DEBUG = false;
    /** @const */
    var MISUSE_CHECK = DEBUG || false;
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
        var rootModule: RequireContext = { d: 1, c: [] };
        rootModule.s = rootModule;

        setTimeout(() => {
                if (rootModule.c) { // If we haven't resolved the context yet...
                    // Time-out
                    rootModule.d = 0/1; // Make sure the context is never resolved
                    err(TimeOut);
                }
            }, (opt.waitSeconds || DefaultTimeout)*1000);

        flushDefines(rootModule);
    }

    function errstr(e, name) {
        return ["Timeout loading module", "Error loading module: "][e] + (name || '');
    }

    global.require.config = function (o) {
        opt = o;
        err = o.error || ((e, name) => { throw errstr(e, name); });
    }

    var modules: ModuleDict = { require: { v: global.require } },
        defPromise: Promise<RequireContext> = { c: [] },
        requested = {},
        opt,
        err;

    function then<T>(m: Promise<T>, f: (m: T, ctx?: any) => void) {
        !m.c ? f(m.v) : m.c.push(f);
    }

    function resolve<T>(m: Promise<T>, mobj?: T) {
        if (m.c) { // Only resolve once
            if (mobj) m.v = mobj;
            m.c.map(cb => cb(mobj)); // .map is not ideal here, but we lose at least 7 bytes switching to something else!
            m.c = null;
        }
    }

    function flushDefines(ctx) {
        DEBUG && console.log('Flusing defines');
        resolve(defPromise, ctx);
        defPromise = { c: [] };
    }

    function getPath(name: string): string {
        return (opt.baseUrl || '') + (opt.paths[name] || name) + '.js';
    }

    function getModule(name: string): Module {
        return modules[name] || (modules[name] = { v: {}, d: 1, c: [] });
    }

    function requestLoad(name, mod, ctx) {
        var m: Module,
            path = getPath(name),
            existing = modules[name];

        m = getModule(name);

        DEBUG && console.log('Looking for ' + name + ', found ' + m)

        if (!existing && !requested[path]) { // Not yet loaded
            
            requested[path] = true;

            DEBUG && console.log('Requesting ' + path);

            if (SIMULATE_RANDOM_404 && Math.random() < 0.3) {
                path += '_spam';
            }
            
            // type = 'text/javascript' is default
            var node = document.createElement('script');
            node.async = true; // TODO: We don't need this in new browsers as it's default.
            node.src = path;
            node.onload = () => { ctx.s = m; flushDefines(ctx); };
            node.onerror = () => { ctx.c = 0; ctx.d = 0/1; err(LoadError, name); };

            if (!SIMULATE_TIMEOUT) {
                document.head.appendChild(node);
            } else if (Math.random() < 0.3) {
                setTimeout(function () { document.head.appendChild(node) }, (opt.waitSeconds || DefaultTimeout) * 1000 * 2);
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
            name = null;
            if (!def) {
                def = deps;
                deps = [];
            }
        }

        DEBUG && console.log('Schedule define called ' + name);
        then(defPromise, ctx => {
            var depPromises;
            if (!mod) { mod = ctx.s; ctx.s = null; }

            if (MISUSE_CHECK && !mod) throw 'Ambiguous anonymous module';

            // Set exports object so that we can import it
            modules.exports = { v: mod.v };

            function dec() {
                if (!--mod.d) {
                    resolve(mod, def.apply(null, depPromises.map(p => {
                        return p.v;
                    })));    
                }
            }

            depPromises = deps.map(depName => {
                ++mod.d;
                var dep = requestLoad(depName, mod, ctx);
                then(dep, dec);
                return dep;
            });

            dec();
        });
    }

    global.define.amd = true;

})(this)