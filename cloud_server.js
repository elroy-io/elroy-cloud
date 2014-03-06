var http = require('http');
var spdy = require('spdy');
var WebSocketServer = require('ws').Server;
var websocket = require('websocket-stream');
var FogAgent = require('./fog_agent');

var webSocket = null;
var socket;
var idCounter = 0;

var clients = {};
var subscriptions = {};

var server = http.createServer(function(req, res) {
  if (!webSocket) {
    res.statusCode = 500;
    res.end();
    return;
  }
  var messageId = ++idCounter;

  clients[messageId] = res;//req.socket; Will need socket for event broadcast.

  req.headers['elroy-message-id'] = messageId;

  socket = websocket(webSocket);
  
  ['setTimeout', 'destroy', 'destroySoon'].forEach(function(key) {
    socket[key] = function() {};
  });

  socket.setTimeout = function() { };
  var agent = spdy.createAgent(FogAgent, {
    socket: socket,
    spdy: {
      plain: true,
      ssl: false
    }
  });

  var opts = { method: req.method, headers: req.headers, path: req.url, agent: agent };
  var request = http.request(opts, function(response) {
    var id = response.headers['elroy-message-id'];
    var res = clients[id];

    response.pipe(res);

    delete clients[id];
  });

  req.pipe(request);

  request.end();
});

var onmessage = function(data) {
  return; // TODO: implement event streaming with server push

  var response = data.split('\r\n\r\n');
  var headersNShit = response.shift().split('\r\n');
  var body = response.join();

  var statusLine = headersNShit.shift();

  var res;
  var queueName;

  headersNShit.forEach(function(header) {
    var headerPair = header.split(':');
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
  }
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
  }else if(ws.upgradeReq.url === '/events'){
    setupEventSocket(ws);
  }
});

server.listen(process.env.PORT || 3000);
