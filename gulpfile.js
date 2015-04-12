var gulp = require('gulp');
var ts = require('gulp-typescript');

var proj = ts.createProject({
	module: 'amd',
	target: 'ES5'
});

gulp.task('lib', function () {
	var tsResult = gulp.src(['src/*.ts', 'test/*.ts'])
		.pipe(ts(proj));

	return tsResult.js
		.pipe(gulp.dest('build'));
});

gulp.task('watch', ['lib'], function () {
	gulp.watch(['src/*.ts', 'test/*.ts'], ['lib']);
})