//declare function require(name);

var http = require('http'),
	finalHandler = require('finalhandler'),
	serveStatic = require('serve-static');

var serve = serveStatic('build');

var server = http.createServer(function (req, res) {
	var done = finalHandler(req, res);
	serve(req, res, done);
});

var port = 8080;
console.log('listening to port ' + port + '\n');
server.listen(port);