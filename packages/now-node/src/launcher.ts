import { Server } from 'http';
import { Bridge } from './bridge';

let listener;

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

try {
// PLACEHOLDER
} catch (err) {
  if (err.code === 'MODULE_NOT_FOUND') {
    console.error(err.message);
    console.error('Did you forget to add it to "dependencies" in `package.json`?');
    process.exit(1);
  } else {
    throw err;
  }
}

const server = new Server(listener);
const bridge = new Bridge(server);
bridge.listen();

exports.launcher = bridge.launcher;
