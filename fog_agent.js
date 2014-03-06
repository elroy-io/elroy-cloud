var Agent = require('http').Agent;
var util = require('util');

var FogAgent = module.exports = function(options) {
  Agent.call(this, options);
  this.socket = options.socket;
};
util.inherits(FogAgent, Agent);

FogAgent.prototype.createConnection = function() {
  return this.socket;
};
