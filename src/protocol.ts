define(['transducers'], function (td) {

	var queue = [],
		queuedActions = [],
		results = [],
		sendTimer: number,
		curMethod: number,
		protocolUrl: string;

	function call(method, body): Signal<any> {
		var sig = td.sig(true);
		
		var q: { b; d? } = { b: body };
		//queue.push(q);

		/*
		1. Pipeline signals that are not yet sent with references.
		2. If we find a signal that cannot be pipeline
		*/

		var path = [],
			o = 1,
			depsMissing;

		function schedule() {
			var i = queue.length;
			sig.i = i;
			queue.push(q);
			queuedActions.push(results => {
				sig(results[i]);
			});
		}

		function dec() {
			!--o || schedule();
		}

		function traverseObj(parent, k) {
			var obj = parent[k];
			if (typeof obj == 'object') {
				Object.keys(obj).some(<any>function (k, index) {
					path.push(k);
					traverseObj(obj, k);
					path.pop();
				});
			} else if (Array.isArray(obj)) {
				obj.some(<any>function (k, index) {
					path.push(k);
					traverseObj(obj, index);
					path.pop();
				});
			} else if (obj.t === td.sig) {
				++o;
				if (!obj.then(v => { parent[k] = v; dec(); })) {
					depsMissing = depsMissing || obj.i == void 0;
					q.d = q.d || {};
					q.d.push([ path.join('.'), obj.i ]);
					parent[k] = void 0;
				}
			}
		}

		traverseObj(q, 0);

		if (!depsMissing) {
			schedule();
		} else {
			q.d = void 0;
			dec(); // Let signals trigger scheduling
		}

		return sig;
	}

	function flush() {
		if (true) {
			var req = new XMLHttpRequest();

			var q = queue, qa = queuedActions;
			queue = [];
			queuedActions = [];

			function x() {
				var status = req.status,
					headers = req.getAllResponseHeaders();
			}

			req.onreadystatechange = () => {

				if (req.readyState > 3) {
					// DONE
					x();
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
