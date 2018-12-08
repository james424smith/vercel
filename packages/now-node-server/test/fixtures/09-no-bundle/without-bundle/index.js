const http = require('http');
const isBundled = require('./is-bundled.js');

const server = http.createServer((req, resp) => {
  resp.end(isBundled() ? '' : 'RANDOMNESS_PLACEHOLDER:without-bundle');
});

server.listen();
