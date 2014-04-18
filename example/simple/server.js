var Server = require('../../');

var s = new Server();

s.setup();

s.listen(process.env.PORT || 3000);
