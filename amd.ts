interface Define {
    (def: (...d: any[]) => any);
    (deps: string[], def: (...d: any[]) => any);
    (name: string, deps: string[], def: (...d: any[]) => any);
}

interface Require {
    (def: (...d: any[]) => any);
    (deps: string[], def: (...d: any[]) => any);
    config(conf: { paths: any });
}

interface Promise<T> {
    c?: ((m: T, ctx?: any) => void)[];
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
}

declare var define: Define;
declare var require: Require;

(function (global) {

    global.require = <any>function (deps?: any, def?: (...d: any[]) => any) {
        var ctx = { c: [], n: 0 };
        global.define(null, deps, def);
        loadSuccess({}, ctx);
    }

    global.require.config = function (c) {
        conf = c;
    }

    var head = document.getElementsByTagName('head')[0],
        modules: ModuleDict = { require: { v: global.require } },
        defPromise: Promise<Module> = { c: [] },
        conf;

    function then<T>(m: Promise<T>, f: (m: T, ctx?: any) => void) {
        // We use unshift so that we can use a promise for post-order traversal too
        !m.c ? f(m.v) : m.c.unshift(f);
    }

    function resolve<T>(m: Promise<T>, mobj?: T, ctx?: any) {
        if (m.c) { // Only resolve once
            m.c.map(cb => cb(mobj, ctx));
            m.c = null;
            m.v = mobj;
        }
    }

    function depDone(ctx: RequireContext) {
        if (!ctx.n) {
            resolve(ctx);
        }
    }

    function loadSuccess(singleMod?: Module, ctx?: RequireContext) {
        resolve(defPromise, singleMod, ctx);
        defPromise = { c: [] };
    }

    function loadError() {
        //console.log('B');
    }

    function getPath(name: string): string {
        var path = conf.paths[name] || name;
        return (conf.baseUrl || '')
             + path
             + (/\.js$/.test(path) ? '' : '.js'); // Auto-add .js if missing
    }

    function getModule(name: string): Module {
        var key = getPath(name);
        return modules[key] || (modules[key] = { n: name, c: []});
    }

    function requestLoad(name, mod, ctx) {
        var m: Module,
            path = getPath(name);

        if (name == 'exports') {
            m = { v: {} };
            resolve(mod, m.v);
        } else {
            m = modules[path];
        }

        if (!m) {
            ++ctx.n;
            
            m = getModule(name);
            
            // type = 'text/javascript' is default
            var node = document.createElement('script');
            node.async = true;
            node.src = path;
            node.onload = function () { loadSuccess(m, ctx); --ctx.n; depDone(ctx); };
            node.onerror = loadError;
            head.appendChild(node);
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

        then(defPromise, (singleMod, ctx) => {
            mod = mod || singleMod;

            // TODO: If mod is not set, this is an ambiguous anonymous module

            var depPromises = deps.map(depName => requestLoad(depName, mod, ctx));

            then(ctx, () => {
                resolve(mod, def.apply(null, depPromises.map(p => p.v))); // TODO: If p.v is not set, we have an unbroken circular dependency
            });
            depDone(ctx);
        });
    }

})(this)