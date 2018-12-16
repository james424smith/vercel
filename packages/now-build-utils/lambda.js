const assert = require('assert');
const Sema = require('async-sema');
const { ZipFile } = require('yazl');
const streamToBuffer = require('./fs/stream-to-buffer.js');

class Lambda {
  constructor({
    zipBuffer, handler, runtime, environment,
  }) {
    this.type = 'Lambda';
    this.zipBuffer = zipBuffer;
    this.handler = handler;
    this.runtime = runtime;
    this.environment = environment;
  }
}

const sema = new Sema(10);
const mtime = new Date(1540000000000);

async function createLambda({
  files, handler, runtime, environment = {},
}) {
  assert(typeof files === 'object', '"files" must be an object');
  assert(typeof handler === 'string', '"handler" is not a string');
  assert(typeof runtime === 'string', '"runtime" is not a string');
  assert(typeof environment === 'object', '"environment" is not an object');

  await sema.acquire();
  try {
    const zipFile = new ZipFile();
    const zipBuffer = await new Promise((resolve, reject) => {
      Object.keys(files)
        .sort()
        .forEach((name) => {
          const file = files[name];
          const stream = file.toStream();
          stream.on('error', reject);
          zipFile.addReadStream(stream, name, { mode: file.mode, mtime });
        });

      zipFile.end();
      streamToBuffer(zipFile.outputStream).then(resolve).catch(reject);
    });

    return new Lambda({
      zipBuffer,
      handler,
      runtime,
      environment,
    });
  } finally {
    sema.release();
  }
}

module.exports = {
  Lambda,
  createLambda,
};
