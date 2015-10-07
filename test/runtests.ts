hyptest.freshtest('circular modules', () => {
	require.config({ paths: {}});

	var p = hyptest.promise()

	define("a", ["exports", "b"], (exports, b) => { exports.b = b; });
	define("b", ["exports", "a"], (exports, a) => { exports.a = a; });
	require(["a", "b"], (a, b) => {
		hyptest.eq(a, b.a);
		hyptest.eq(b, a.b);
		p.resolve();
	});

	return p;
});

hyptest.freshtest('straight modules', () => {
	require.config({ paths: {}});

	var p = hyptest.promise()

	define("a", ["b"], (b) => { return { b: b }; });
	define("b", [], () => { return { } });

	require(["a", "b"], (a, b) => {
		hyptest.eq(b, a.b);
		p.resolve();
	});

	return p;
});

hyptest.freshtest('forward and backwards modules', () => {
	require.config({ paths: {}});

	var p = hyptest.promise()

	define("b", ["c"], (c) => { return { c: c } });
	define("a", ["b"], (b) => { return { b: b }; });
	define("c", [], () => { return { } });

	require(["a", "b", "c"], (a, b, c) => {
		hyptest.eq(c, b.c);
		hyptest.eq(b, a.b);
		p.resolve();
	});

	return p;
});

hyptest.start();