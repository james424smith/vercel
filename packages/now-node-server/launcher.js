const { Server } = require('http');
const { Bridge } = require('./bridge.js');

const bridge = new Bridge();

const saveListen = Server.prototype.listen;
Server.prototype.listen = function listen(...args) {
  this.on('listening', function listening() {
    bridge.port = this.address().port;
  });
  saveListen.apply(this, args);
};

try {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }

  // PLACEHOLDER
} catch (error) {
  console.error(error);
  bridge.userError = error;
}

exports.launcher = bridge.launcher;
