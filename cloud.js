var http = require('http');
var spdy = require('spdy');
var FogAgent = require('./fog_agent');
var WebSocketServer = require('ws').Server;

var ElroyCloud = module.exports = function() {
  this.webSocket = null;
  this.idCounter = 0;

  this._collectors = {};
  this.clients = {};
  this.subscriptions = {};
  this.eventRequests = {};

  this.agent = null;

  var self = this;
  this.server = http.createServer(function(req, res) {
    if (!self.webSocket) {
      res.statusCode = 500;
      res.end();
      return;
    }
    var messageId = ++self.idCounter;

    self.clients[messageId] = res;//req.socket; Will need socket for event broadcast.

    req.headers['elroy-message-id'] = messageId;


    var opts = { method: req.method, headers: req.headers, path: req.url, agent: self.agent };
    var request = http.request(opts, function(response) {
      var id = response.headers['elroy-message-id'];
      var res = self.clients[id];

      Object.keys(response.headers).forEach(function(header) {
        if (header !== 'elroy-message-id') {
          res.setHeader(header, response.headers[header]);
        }
      });

      response.pipe(res);

      delete self.clients[id];
    });

    req.pipe(request);
  });

  this.wss = new WebSocketServer({ server: this.server });
  this.wss.on('connection', function(ws) {
    if (ws.upgradeReq.url === '/'){
      ws._socket.removeAllListeners('data'); // Remove WebSocket data handler.

      self.webSocket = ws._socket;

      self.webSocket.on('end', function() {
        self.webSocket = null;
        self.subscriptions = {};
        self._collectors = {};
      });

      self.agent = spdy.createAgent(FogAgent, {
        host: 'localhost',
        port: 80,
        socket: ws._socket,
        spdy: {
          plain: true,
          ssl: false
        }
      });

      // TODO: Remove this when bug in agent socket removal is fixed.
      self.agent.maxSockets = 150;
      //console.log(self.agent.maxSockets);

      self.agent.on('push', function(stream) {
        if (!self.subscriptions[stream.url] && !self._collectors[stream.url]) {
          stream.connection.associated.end();
        }

        var data = [];
        var len = 0;
        stream.on('readable', function() {
          while (d = stream.read()) {
            data.push(d);
            len += d.length;
          };
        });

        stream.on('error', function(err) {
          console.error('error on push:', err);
        });

        stream.on('end', function() {
          if (!self.webSocket) {
            stream.connection.end();
            return;
          }
          var queueName = stream.url;
          var body = data.join();

          if(self._collectors[queueName] && self._collectors[queueName].length){
            self._collectors[queueName].forEach(function(collector){
              collector(data);
            });
          }

          if(self.subscriptions[queueName] && self.subscriptions[queueName].length){
            self.subscriptions[queueName].forEach(function(client){
              var data;

              try {
                data = JSON.parse(body);
              } catch(e) {
                data = body;
              }

              client.send(JSON.stringify({ destination : queueName, data : data }));
            });
          }

          stream.connection.end();
        });
      });

      var keys = Object.keys(self._collectors).concat(Object.keys(self.subscriptions));

      keys.forEach(function(k){
        self._subscribe(k);  
      });

      setInterval(function() {
        self.agent.ping(function(err) {
          //TODO: Handle a lack of PONG.
        });
      }, 10 * 1000);

    } else if(ws.upgradeReq.url === '/events'){
      self.setupEventSocket(ws);
    }
  });
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

      if (self.subscriptions[channel].length === 0) {
        //console.log('deleting subscription:', channel);
        delete self.subscriptions[channel];
        var con = self.eventRequests[channel].connection;
        //con.end();
        //console.log(self.agent.sockets);
        /*var idx = null;
        console.log('hosts:', Object.keys(self.agent.sockets));
        Object.keys(self.agent.sockets).forEach(function(host) {
          console.log(host);
          self.agent.sockets[host].forEach(function(sock, i) {
            console.log(i);
            if (sock === con.socket) {
              sock.end();
              idx = i;
            }
          });

          if (idx !== null) {
            self.agent.sockets[host].splice(idx);
          }
        });*/
        delete self.eventRequests[channel];
        //console.log(self.agent.sockets);
      }
    });
  }

  ws.on('close',function(){
    //console.log('closing socket');
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
      var isNew = false;
      if(!self.subscriptions[msg.name]) {
        self.subscriptions[msg.name] = [];
        isNew = true;
      }

      //console.log('isNew:', isNew);
      self.subscriptions[msg.name].push(ws);

      if (isNew) {
        self._subscribe(msg.name);
      }
    }
  };
}

ElroyCloud.prototype.listen = function(){
  this.server.listen.apply(this.server,arguments);
  return this;
};

ElroyCloud.prototype.collector = function(name,collector){
  if(typeof name === 'function'){
    collector = name;
    name = '_logs';
  }

  if(!this._collectors[name])
    this._collectors[name] = [];

  this._collectors[name].push(collector);

  return this;
};

ElroyCloud.prototype._subscribe = function(event) {
  //console.log('subscribing to:', event);
  var self = this;
  var body = 'name='+event;

  var opts = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Host': 'fog.argo.cx',
      'Content-Length': body.length
    },
    path: '/_subscriptions',
    agent: this.agent
  };

  var req = http.request(opts);
  req.end(new Buffer(body));
  self.eventRequests[event] = req;
};
