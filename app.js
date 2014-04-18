var ZettaCloud = require('zetta-runtime').ZettaCloud;

var cloud = new ZettaCloud();
cloud.setup();
cloud.listen(process.env.PORT || 3000);
