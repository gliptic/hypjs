//var watch = require('watch');
var fs = require('fs'),
	path = require('path'),
	ch = require('child_process'),
	zopfli = require('node-zopfli');

var args = process.argv.slice(1);
var name = args[1];

var from = path.resolve(__dirname, 'build', name + '.js');
var to = path.resolve(__dirname, 'src', name + '.min.js');
process.stdout.write(from + '\n');

var running = false;

fs.watch(from, function () {
	if (!running) {
		process.stdout.write('--- ' + new Date().toISOString() + ' ---\n');

		var proc = ch.spawn('java', ['-jar', 'compiler.jar', '--language_in=ECMASCRIPT6', '--language_out=ES5', '--js_output_file=' + to, from]);
		running = true;
		proc.on('exit', function () {
			fs.readFile(to, function (err, data) {
				if (!err) {
					zopfli.gzip(data, {}, function(err, gziped) {
						if (!err) {
							process.stdout.write('Size: ' + gziped.length + '\n');
						}
					});
				}
			});
			running = false;
		})
		
	}
});