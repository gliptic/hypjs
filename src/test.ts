module hyptest {
	var DEBUG = false;

	export interface Test {
		name: string;
		f: () => any;
		reuse: boolean;
		timeout?: number;
	}

	enum TestResult {
		Unknown,
		Ok,
		Fail
	}

	interface RunState {
		testindex: number;
		results: { errors: string[], state: TestResult }[];
	}

	var tests: Test[] = [];

	var runState: RunState;

	export function promise(): any {
		var c = [], v;
		return {
			resolve: (rv) => {
				if (c) {
					v = rv;
					c.map(f => f(rv));
					c = null;
				}
			},
			then: (f) => {
				if (c) c.push(f); else f(v);
			}
		}
	}

	export function freshtest(name: string, f: () => any) {
		tests.push({ name: name, f: f, reuse: false });
	}

	export function test(name: string, f: () => any) {
		tests.push({ name: name, f: f, reuse: true });
	}

	function refresh() {
		DEBUG && console.log('Storing state', runState);
		localStorage.setItem('state', JSON.stringify(runState));
		location.hash = '#continue=' + runState.testindex;
		location.reload();
	}

	function done() {
		var fails = 0, success = 0;
		runState.results.forEach((r, idx) => {
			if (r.state === TestResult.Ok)
				++success;
			else {
				++fails;
				console.log('Errors for ' + tests[idx].name + ':', r.errors);
			}
		});
		console.log('Done. ' + success + ' ok, ' + fails + ' failed');


	}

	function nexttest() {
		++runState.testindex;
		if (runState.testindex >= tests.length) {
			done();
		} else {
			if (tests[runState.testindex].reuse) {
				tick();
			} else {
				DEBUG && console.log('Have to refresh for test');
				refresh();
			}
		}
	}

	function protectedF(f) {
		var curIndex = runState.testindex;
		return function () {
			if (runState.testindex === curIndex) {
				f();
			}
		}
	}

	var next;

	function tick() {
		var test = tests[runState.testindex];
		var result = getResult();

		var timer;
		next = protectedF(() => {
			clearTimeout(timer);
			result.state = result.errors.length ? TestResult.Fail : TestResult.Ok;
			nexttest();
		});

		var timeout = test.timeout || 5;

		DEBUG && console.log('Starting test', test.name);
		var promise = test.f();

		if (promise) {
			timer = setTimeout(() => {
				addError('Timeout');
				next();
			}, timeout * 1000);

			promise.then(next);
		} else {
			next();
		}
	}

	export function eq(expected, actual) {
		if (expected !== actual) {
			addError('Expected ' + expected + ', was ' + actual);
		}
	}

	export function start() {
		runState = {
			testindex: 0,
			results: []
		};

		var h = location.hash.split('=');

		if (h[0] === '#continue') {
			runState = JSON.parse(localStorage.getItem('state'));
			DEBUG && console.log('Loaded state', runState);
			if ((+h[1]) !== runState.testindex) {
				throw 'Hash param does not correspond to stored state';
			}
		}

		tick();
	}

	function getResult() {
		return runState.results[runState.testindex] || (runState.results[runState.testindex] = { errors: [], state: TestResult.Unknown });
	}

	function addError(errstr: string) {
		getResult().errors.push(errstr);
	}

	window.onerror = function (message, url, line, column, err) {
		addError(message);
		if (next) next();
	};
}