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

type Def = ((m: any) => any);

interface Promise {
    c?: Def[];
    v?: any;
}

interface Module extends Promise {
    n?: string;
}

interface ModuleDict {
    [name: string]: Module;
    exports?: any;
}

//type RequireContext = [mod: Module, def: Def, resolvedDeps: Module[]][];

declare var define: Define;
declare var require: Require;

(function (global) {
    var head = document.getElementsByTagName('head')[0];

    var modules: ModuleDict = {};
    var defPromise: Promise = { c: [] };
    var paths: {};

    function then(m: Module, f: (m: any) => any) {
        console.log(m);
        m.v ? f(m.v) : m.c.push(f);
    }

    function resolve(m: Module, mobj?: any) {
        if (m.c) { // Only resolve once
            m.c.map(cb => cb(mobj));
            m.c = null;
            m.v = mobj;
        }
    }

    function loadSuccess(singleMod?: Module) {
        resolve(defPromise, defPromise.c.length == 1 && singleMod);
        defPromise = { c: [] };
    }

    function loadError() {
        console.log('B');
    }

    function requestLoad(name, mod/*, ctx*/) {
        var m;
        if (name == 'exports') {
            m = { v: {} };
            resolve(mod, m.v);
        } else {
            m = modules[name];
        }

        if (!m) {
            m = (modules[name] = { n: name, c: []});
            var path = paths[name] || name;

            // type = 'text/javascript' is default
            var node = document.createElement('script');
            node.async = true;
            node.src = path;
            node.onload = function () { loadSuccess(m) };
            node.onerror = loadError;
            head.appendChild(node);
        }
        return m;
    }
    
    function getModule(moduleName: string): Module {
        return modules[moduleName] || (modules[moduleName] = { n: moduleName, c: []});
    }

    function runModule(mod, def, resolvedDeps) {
        resolve(mod, def.apply(null, resolvedDeps));
    }

    define = function (name: any, deps?: any, def?: (...d: any[]) => any /*, ctx: RequireContext*/) {
        if (!def) {
            def = deps;
            deps = name;
            if (!def) {
                def = deps;
                deps = [];
            }
        }

        var mod = name && getModule(name);
        
        then(defPromise, singleMod => {
           
            mod = mod || singleMod;

            var left = deps.length;
            var resolvedDeps = [];

            deps.map((depName, index) => {
                var depMod = requestLoad(depName, mod/*, ctx*/);
                then(depMod, m => {
                    resolvedDeps[index] = m;
                    if (!--left) {

                        resolve(mod, def.apply(null, resolvedDeps));
                    }
                });
            });
        });
    };

    require = <any>function (deps?: any, def?: (...d: any[]) => any) {
        define(null, deps, def);
        // TODO: Wait on complete load of all modules in defPromise (not just resolve of the promise)
        loadSuccess({});
    }

    require.config = function (conf) {
        paths = conf.paths;
    }

})(this)