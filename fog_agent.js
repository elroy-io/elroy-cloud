var Agent = require('http').Agent;
var util = require('util');

var FogAgent = module.exports = function(options) {
  this.socket = options.socket;
  Agent.call(this, options);
};
util.inherits(FogAgent, Agent);

FogAgent.prototype.createConnection = function(options) {
  console.log(options.socket === this.socket);
  console.log('create connection called ---------------------<');
  console.log('writable from options:', options.socket.writable);
  return options.socket;
};
