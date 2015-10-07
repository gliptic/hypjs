var gulp = require('gulp');
var ts = require('gulp-typescript');

/*
var proj = ts.createProject({
	module: 'amd',
	target: 'ES5',
	jsx: 'react',
	experimentalAsyncFunctions: true
});
*/

var proj = ts.createProject('tsconfig.json');

gulp.task('lib', function () {
	var tsResult = gulp.src(['src/*.ts', 'test/*.ts', 'test/*.tsx'])
		.pipe(ts(proj));

	return tsResult.js
		.pipe(gulp.dest('build'));
});

gulp.task('copyhtml', function () {
	var html = gulp.src('test/*.html')
		.pipe(gulp.dest('build'));
});

gulp.task('watch', ['lib', 'copyhtml'], function () {
	gulp.watch(['src/*.ts', 'test/*.ts', 'test/*.tsx'], ['lib']);
	gulp.watch(['test/*.html'], ['copyhtml']);
})