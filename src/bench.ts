interface Bench {
	name: string;
	f: () => number;
	iterations: number;
	totalCount: number;
	timeLeft: number;
	minTimePerIter: number;
	sum: number;
}

var DEBUG = false;

var benches: Bench[] = [];

export function bench(name: string, f: () => number) {
	benches.push({ name: name, f: f, iterations: 1, totalCount: 0, timeLeft: 5000, minTimePerIter: Infinity, sum: 0 });
}

export function run() {
	var bi = 0;
	
	function next() {
		while (true) {
			if (bi >= benches.length) {
				bi = 0;
				if (!benches.some(b => b.timeLeft > 0)) {
					return done();
				}
			}

			if (benches[bi].timeLeft > 0)
				break;

			++bi;
		}

		var b = benches[bi];
		var iter = b.iterations;
		var bef = performance.now();
		var sum = 0;
		for (var i = 0; i < iter; ++i) {
			sum += b.f();
		}

		b.sum += sum;

		var time = performance.now() - bef;
		var timePerIter = time / iter;
		var prevMinTimePerIter = b.minTimePerIter;
		b.minTimePerIter = Math.min(b.minTimePerIter, timePerIter);
		if (time >= 500) {
			DEBUG && console.log('ran', iter, 'iterations of', b.name, 'at', b.minTimePerIter, ', total =', time);
			++bi;
		} else {
			var estimated = ~~(b.iterations / (time / 1000));
			DEBUG && console.log('total =', time);
			DEBUG && console.log('Estimated necessary iterations of', b.name, '=', estimated, 'turns up at', estimated * timePerIter);
			b.iterations = Math.max(b.iterations,
				Math.min(b.iterations * 4, estimated));
		}
		b.timeLeft -= time;

		setTimeout(next, 0);
	}

	function done() {
		benches.forEach(b => {
			console.log(b.name, ':', b.minTimePerIter, b.iterations);
		});
	}

	next();
}