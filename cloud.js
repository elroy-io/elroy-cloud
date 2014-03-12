var http = require('http');
var WebSocketServer = require('ws').Server;
var parseRequest = require('./reqstring');

var ElroyCloud = module.exports = function(){
  var self = this;

  this._collectors = [];

  this.webSocket = null;
  this.idCounter = 0;

  this.clients = {};
  this.subscriptions = {};

  this.server = http.createServer(function(req, res) {
    if (!webSocket) {
      res.statusCode = 500;
      res.end();
      return;
    }

    var messageId = ++idCounter;
    clients[messageId] = res;//req.socket; Will need socket for event broadcast.
    req.headers['elroy-message-id'] = messageId;
    parseRequest(req, function(err, reqString) {
      self.webSocket.send(reqString);
    });
  });

  this.wss = new WebSocketServer({ server: this.server });
  this.wss.on('connection', function(ws) {
    if(ws.upgradeReq.url === '/'){
      self.webSocket = ws;
      self._subscribe('_logs',self.webSocket);
      self.webSocket.on('message', self.onmessage.bind(self) );
    }else if(ws.upgradeReq.url === '/events'){
      self.setupEventSocket(ws);
    }
  });
}

ElroyCloud.prototype.collector = function(collector){
  this._collectors.push(collector);
};

ElroyCloud.prototype.listen = function(){
  this.server.listen.apply(this.server,arguments);
};

ElroyCloud.prototype.onmessage = function(data) {
  var self = this;

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
      res = self.clients[parseInt(messageId)];
    }

    if(headerPair[0] === 'elroy-queue-name') {
      queueName = headerPair[1];
    }
  });


  if(queueName) {
    var data;
    try {
      data = JSON.parse(body);
    } catch(e) {
      data = body;
    }

    self._collectors.forEach(function(collector){
      collector(data);
    });

    if(self.subscriptions[queueName]){
      var sendData = JSON.stringify({ destination : queueName, data : data });
      self.subscriptions[queueName].forEach(function(client){
        client.send(sendData);
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


ElroyCloud.prototype.setupEventSocket = function(ws){
  var self = this;

  ws.on('message', onEventMessage);

  function closeSocket(){
    Object.keys(self.subscriptions).forEach(function(channel){
      self.subscriptions[channel].forEach(function(c,idx){
        if(c === ws)
          self.subscriptions[channel].splice(idx,1);  
      });
    });
  }

  ws.on('close',function(){
    closeSocket();  
  });

  ws.on('error',function(err){
    console.error(err);
    closeSocket();
  });
  
  function onEventMessage (data){
    var msg = null;
    try{
     msg = JSON.parse(data);
    }catch(err){
      console.error(err);
      return;
    }

    if(msg.cmd === 'subscribe' && msg.name){
      if(!self.subscriptions[msg.name])
        self.subscriptions[msg.name] = [];
      self.subscriptions[msg.name].push(ws);

      if(self.webSocket)
        self._subscribe(msg.name,self.webSocket);
    }
  };
}

ElroyCloud.prototype._subscribe = function(event,ws){
  var body = 'name='+event;

  var reqStr = 'POST /_subscriptions HTTP/1.1\r\n';
  reqStr += 'Content-Type:application/x-www-form-urlencoded\r\n';
  reqStr += 'Host:argo.fog.com\r\n';
  reqStr += 'Content-Length:'+body.length+'\r\n\r\n';
  reqStr += body;

  ws.send(reqStr);
};
