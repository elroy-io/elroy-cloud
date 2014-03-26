var Server = require('./cloud');

var s = new Server();

s.listen(process.env.PORT || 3000);
