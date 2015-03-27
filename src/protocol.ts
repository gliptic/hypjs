define(['transducers'], function (td) {

    var queue = [],
        queuedSigs = [],
        sendTimer: number,
        curMethod: number = 0,
        protocolUrl: string;

    function call(method, body): Signal<any> {
        var sig = td.sig(true);
        
        var q: { b; d? } = { b: body },
            path = [],
            o = 1,
            depsMissing;

        function schedule() {
            var i = queue.length;
            sig.i = i;
            queue.push(q);
            queuedSigs.push(sig);
        }

        function dec() {
            --o || schedule();
        }

        function traverseObj(parent, k) {
            var obj = parent[k];
            path.push(k);
            if (typeof obj == 'object') {
                Object.keys(obj).some(<any>function (k, index) {
                    traverseObj(obj, k);
                });
            } else if (Array.isArray(obj)) {
                obj.some(<any>function (k, index) {
                    traverseObj(obj, index);
                });
            } else if (obj.t === td.sig) {
                ++o;
                obj.some(v => { parent[k] = v; dec(); });
                if (obj.cur() !== void 0) {
                    depsMissing = depsMissing || obj.i == void 0;
                    (q.d = q.d || {}).push([ path.slice(1), obj.i ]);
                    parent[k] = void 0;
                }
            }
            path.pop();
        }

        traverseObj(q, 0);

        if (depsMissing) {
            q.d = void 0;
            dec(); // Let signals trigger scheduling
        } else {
            schedule();
        }

        return sig;
    }

    function flush() {
        if (queue.length) {
            var req = new XMLHttpRequest();

            var q = queue, qa = queuedSigs;
            queue = [];
            queuedSigs = [];

            function x() {
                var status = req.status,
                    headers = req.getAllResponseHeaders();
            }

            req.onreadystatechange = () => {

                if (req.readyState > 3) {
                    // DONE
                    x();

                    if (('' + req.status)[0] == <any>2) {
                        var results = JSON.stringify(req.responseText);
                        qa.some((v, index) => v(results[index], true));
                    } else {
                        qa.some(v => v(void 0, true)); // TODO: Send error
                    }
                } else if (req.readyState > 1) {
                    // HEADERS_RECEIVED or LOADING
                    return x();
                }
            };

            req.open(["GET"][curMethod], protocolUrl, true);

            req.send(JSON.stringify(q));
        }
    }

    function protocol() {

    }

    (<any>protocol).call = call;
    (<any>protocol).flush = flush;
    

    return protocol;
});
