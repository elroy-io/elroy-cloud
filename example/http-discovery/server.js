var ZettaCloud = require('../../');

var cloud = new ZettaCloud();

cloud.setup();

cloud.listen(process.env.PORT || 3000);
