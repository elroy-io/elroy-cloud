var http = require('http');
var WebSocketServer = require('ws').Server;
var parseRequest = require('./reqstring');
var StompFrame = require('./stomp');

var webSocket = null;
var idCounter = 0;

var clients = {};
var subscriptions = {};

var server = http.createServer(function(req, res) {

  console.log('request..')
  if (!webSocket) {
    res.statusCode = 500;
    res.end();
    return;
  }
  console.log('request..')

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
  var messageId;
  var queueName;

  headersNShit.forEach(function(header) {
    var headerPair = header.split(':');
    if (headerPair[0] === 'elroy-message-id') {
      messageId = headerPair[1];
      res = clients[parseInt(messageId)];
    }

    if(headerPair[0] === 'elroy-queue-name') {
      queueName = headerPair[1];
    }
  });

  if(queueName) {
    if(subscriptions[queueName]){
      subscriptions[queueName].forEach(function(client){
        client.send(JSON.stringify({destination : queueName,data : body}));
      });
    }
    return;
  }

  headersNShit.forEach(function(header) {
    var headerPair = header.split(':');
    if (headerPair[0] !== 'elroy-message-id') {
      res.setHeader(headerPair[0], headerPair[1].trim());
    }
  });

  statusLine = statusLine.split(' ');

  res.statusCode = statusLine[1];
  res.end(body);

  delete clients[messageId];
};


function setupEventSocket(ws){
  ws.on('message', onEventMessage);

  function closeSocket(){
    Object.keys(subscriptions).forEach(function(channel){
      subscriptions[channel].forEach(function(c,idx){
        if(c === ws)
          subscriptions[channel].splice(idx,1);  
      });
    });
  }

  ws.on('close',function(){
    closeSocket();  
  });

  ws.on('error',function(err){
    console.log(err);
    closeSocket();
  });
  
  function onEventMessage (data){
    var msg = null;
    try{
     msg = JSON.parse(data);
    }catch(err){
      console.log(err);
      return;
    }

    if(msg.cmd === 'subscribe' && msg.name){
      if(!subscriptions[msg.name])
        subscriptions[msg.name] = [];
      subscriptions[msg.name].push(ws);

      var body = 'name='+msg.name;

      var reqStr = 'POST /_subscriptions HTTP/1.1\r\n';
      reqStr += 'Content-Type:application/x-www-form-urlencoded\r\n';
      reqStr += 'Host:argo.fog.com\r\n';
      reqStr += 'Content-Length:'+body.length+'\r\n\r\n';
      reqStr += body;

      webSocket.send(reqStr);

    }
  };
}


var wss = new WebSocketServer({ server: server });
wss.on('connection', function(ws) {
  if(ws.upgradeReq.url === '/'){
    webSocket = ws;
    webSocket.on('message', onmessage);
  }else if(ws.upgradeReq.url === '/events'){
    setupEventSocket(ws);
  }
});


server.listen(process.env.PORT || 3000);
