var http = require('http');
var WebSocketServer = require('ws').Server;
var parseRequest = require('./reqstring');
var webSocket = null;


var server = http.createServer(function(req, res) {
 if(webSocket) {
    parseRequest(req, function(err, reqString) {
      webSocket.send(reqString);
    });
    webSocket.once('message', function(data) {
      var response = data.split('\r\n\r\n');
      var headersNShit = response.shift().split('\r\n');
      var body = response.join();

      var statusLine = headersNShit.shift();
      headersNShit.forEach(function(header) {
        var headerPair = header.split(':');
        res.setHeader(headerPair[0], headerPair[1].trim());
      });

      statusLine = statusLine.split(' ');

      res.statusCode = statusLine[1];
      res.end(body);

      //req.socket.write(data);
    });
  }

});

var wss = new WebSocketServer({ server: server });
wss.on('connection', function(ws) {
  webSocket = ws;
});
server.listen(process.env.PORT || 3000);
