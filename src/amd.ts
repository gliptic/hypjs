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
    (name: string);
    config(conf: { paths: any; error: any; timeoutSec: any; baseUrl?: string });
}

interface Promise<T> {
    c?: ((m: T) => void)[];
    a?: any;
}


interface Module extends Promise<any> {
    b?: number;
}

interface ModuleDict {
    [name: string]: Module;
    exports?: any;
    require?: any;
}

interface RequireContext extends Module {
    e?: Module; // The single anonymous module for this context. This is set in onload.
}

declare var define: Define;
declare var require: Require;
declare var exports: any;
declare var __dirname: string;

(function () {
    /** @const */
    var DEBUG = false;
    /** @const */
    var MISUSE_CHECK = DEBUG || false;
    /** @const */
    var SIMULATE_TIMEOUT = false;
    /** @const */
    var SIMULATE_RANDOM_404 = false;
    /** @const */
    var SUPPORT_NODE = true;
    /** @const */
    var DefaultTimeout = 7;

    // tsc still outputs lots of crap for enums so we'll have to make do with this.
    /** @const */
    var TimeOut = 0;
    /** @const */
    var LoadError = 1;

    var isNode = SUPPORT_NODE && typeof window == 'undefined';
    var g = isNode ? exports : window;

    (g.require = <Require>function (deps?: any, def?: (...d: any[]) => any, rootModule?) {
        if (isNode && !def) return require(deps);
        define(deps, def);

        // There may be defines that haven't been processed here because they were
        // made outside a 'require' context. Those will automatically tag along into
        // this new context.
        rootModule = { b: 1, c: [] };
        rootModule.e = rootModule;

        setTimeout(() => {
                if (rootModule.c) { // If we haven't resolved the context yet...
                    // Time-out
                    err(TimeOut);
                }
            }, (opt.waitSeconds || DefaultTimeout)*1000);

        flushDefines(rootModule);
    }).config = function (o) {
        opt = o;
        err = o.error || ((e, name) => { throw errstr(e, name); });
    };

    function errstr(e, name) {
        return ["Timeout loading module", "Error loading module: "][e] + (name || '');
    }

    var modules: ModuleDict = { require: { a: g.require } },
        defPromise: Promise<RequireContext> = { c: [] },
        requested = {},
        opt,
        err;

    function then<T>(m: Promise<T>, f: (m: T, ctx?: any) => void) {
        !m.c ? f(m.a) : m.c.push(f);
        return m;
    }

    function resolve<T>(m: Promise<T>, mobj?: T) {
        if (m.c) { // Only resolve once
            if (mobj) m.a = mobj;
            m.c.map(cb => cb(mobj)); // .map is not ideal here, but we lose at least 7 bytes switching to something else!
            m.c = null;
        }
    }

    function flushDefines(ctx) {
        DEBUG && console.log('Flushing defines');
        resolve(defPromise, ctx);
        defPromise = { c: [] };
    }

    function getPath(name: string): string {
        return (opt.baseUrl || '') + (opt.paths[name] || name) + '.js';
    }

    function getModule(name: string): Module {
        return modules[name] || (modules[name] = { a: {}, b: 1, c: [] });
    }

    function requestLoad(name, mod, ctx, m?: Module, path?, node?) {
        var existing = modules[name];

        m = getModule(name);

        DEBUG && console.log('Looking for ' + name + ', found ' + m)

        if (!existing && !requested[path = getPath(name)]) { // Not yet loaded
            requested[path] = true;

            DEBUG && console.log('Requesting ' + path);

            if (SIMULATE_RANDOM_404 && Math.random() < 0.3) {
                path += '_spam';
            }

            if (isNode) {
                (<any>require)('fs').readFile(__dirname + '/' + path, function (err, code) {
                    (<any>require)('vm').runInThisContext(code, { filename: path });
                    ctx.e = m;
                    flushDefines(ctx);
                });
            } else {
                // type = 'text/javascript' is default
                (node = document.createElement('script'))
                    .async = true; // TODO: We don't need this in new browsers as it's default.
                node.onload = () => { ctx.e = m; flushDefines(ctx); };
                node.onerror = () => { ctx.c = 0; err(LoadError, name); };
                node.src = path;

                if (!SIMULATE_TIMEOUT) {
                    document.head.appendChild(node);
                } else if (Math.random() < 0.3) {
                    setTimeout(function () { document.head.appendChild(node) }, (opt.timeoutSec || DefaultTimeout) * 1000 * 2);
                }
            }
            
        }

        return m;
    }
    
    (define = <any>function(name: any, deps?: any, def?: (...d: any[]) => any, mod?) {

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
        then(defPromise, (ctx, depPromises?) => {
            if (!mod) { mod = ctx.e; ctx.e = null; }

            if (MISUSE_CHECK && !mod) throw 'Ambiguous anonymous module';

            // Set exports object so that we can import it
            modules.exports = { a: mod.a };

            depPromises = deps.map(depName => {
                ++mod.b;
                return then(requestLoad(depName, mod, ctx), dec);
            });
            
            function dec() {
                if (mod.c && !--mod.b) {
                    resolve(mod, def.apply(null, depPromises.map(p => p.a)));    
                }
            }

            dec();
        });
    }).amd = true;

})()