var Server = require('./cloud');

var s = new Server();

function collector(data){
  console.log('log:',data.msg);
}

s.collector(collector);

s.listen(3000);