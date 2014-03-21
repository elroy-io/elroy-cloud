var http = require('http');
var spdy = require('spdy');
var WebSocketServer = require('ws').Server;
var FogAgent = require('./fog_agent');

var webSocket = null;
var idCounter = 0;

var clients = {};
var subscriptions = {};

var agent;

var server = http.createServer(function(req, res) {
  if (!webSocket) {
    res.statusCode = 500;
    res.end();
    return;
  }
  var messageId = ++idCounter;

  clients[messageId] = res;//req.socket; Will need socket for event broadcast.

  req.headers['elroy-message-id'] = messageId;


  var opts = { method: req.method, headers: req.headers, path: req.url, agent: agent };
  var request = http.request(opts, function(response) {
    var id = response.headers['elroy-message-id'];
    var res = clients[id];

    Object.keys(response.headers).forEach(function(header) {
      if (header !== 'elroy-message-id') {
        res.setHeader(header, response.headers[header]);
      }
    });

    response.pipe(res);

    delete clients[id];
  });

  req.pipe(request);
});

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
      if(!subscriptions[msg.name])
        subscriptions[msg.name] = [];
      subscriptions[msg.name].push(ws);

      var body = 'name='+msg.name;

      var opts = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Host': 'fog.argo.cx',
          'Content-Length': body.length
        },
        path: '/_subscriptions',
        agent: agent
      };

      var req = http.request(opts);
      req.end(new Buffer(body));
    }
  };
}


var wss = new WebSocketServer({ server: server });
wss.on('connection', function(ws) {
  if (ws.upgradeReq.url === '/'){
    var readable = ws._socket.listeners('readable')[0];
    ws._socket.removeAllListeners();
    ws._socket.on('readable', readable);

    webSocket = ws._socket;

    agent = spdy.createAgent(FogAgent, {
      host: 'localhost',
      port: 80,
      socket: ws._socket,
      spdy: {
        plain: true,
        ssl: false
      }
    });

    agent.on('push', function(stream) {
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
        var queueName = stream.url;
        var body = data.join();

        if(subscriptions[queueName]){
          subscriptions[queueName].forEach(function(client){
            var data;

            try {
              data = JSON.parse(body);
            } catch(e) {
              data = body;
            }

            client.send(JSON.stringify({ destination : queueName, data : data }));
          });
        }
      });
    });
  } else if(ws.upgradeReq.url === '/events'){
    setupEventSocket(ws);
  }
});

server.listen(process.env.PORT || 3000);
