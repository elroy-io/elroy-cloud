var PhotosensorDriver = module.exports = function(prototype) {
  prototype = prototype || {};

  this.type = 'photosensor';
  this.name = prototype.name;
  this.data = {};
  this.state = prototype.state || 'on';
  this.value = prototype.value || 0;
};

PhotosensorDriver.prototype.init = function(config) {
  config
    .when('on', { allow: 'change' })
    .map('change', this.change, { fields: [ { name: 'value' } ] })
    .stream('value', this.onValue);
};

PhotosensorDriver.prototype.onValue = function(emitter) {
  //setInterval(function() {
    //emitter.emit('data', Math.floor(Math.random() * 100));
  //}, 32);

  /*this.board.on('digitalChange', function(e) {
    emitter.emit('data', e.value);
  });*/
};

PhotosensorDriver.prototype.change = function(value, cb) {
  this.value = value;
  cb();
};
