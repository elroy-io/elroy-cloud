var Agent = require('http').Agent;
var util = require('util');

var FogAgent = module.exports = function(options) {
  this.socket = options.socket;
  Agent.call(this, options);
};
util.inherits(FogAgent, Agent);

FogAgent.prototype.createConnection = function(options) {
  return options.socket;
};
