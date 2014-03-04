var http = require('http');
var WebSocketServer = require('ws').Server;
var parseRequest = require('./reqstring');

var webSocket = null;
var idCounter = 0;

var clients = {};

var server = http.createServer(function(req, res) {
  if (!webSocket) {
    res.statusCode = 500;
    return;
  };

  var messageId = ++idCounter;

  clients[messageId] = res;//req.socket; Will need socket for event broadcast.

  req.headers['elroy-message-id'] = messageId;

  parseRequest(req, function(err, reqString) {
    webSocket.send(reqString);
  });
});

var onmessage = function(data) {
  var response = data.split('\r\n\r\n');
  var headersNShit = response.shift().split('\r\n');
  var body = response.join();

  var statusLine = headersNShit.shift();

  var res;

  headersNShit.forEach(function(header) {
    var headerPair = header.split(':');
    if (headerPair[0] === 'elroy-message-id') {
      res = clients[parseInt(headerPair[1])];
    }
  });

  headersNShit.forEach(function(header) {
    var headerPair = header.split(':');
    if (headerPair[0] !== 'elroy-message-id') {
      res.setHeader(headerPair[0], headerPair[1].trim());
    }
  });

  statusLine = statusLine.split(' ');

  res.statusCode = statusLine[1];
  res.end(body);
};

var wss = new WebSocketServer({ server: server });
wss.on('connection', function(ws) {
  webSocket = ws;
  webSocket.on('message', onmessage);
});

server.listen(process.env.PORT || 3000);
