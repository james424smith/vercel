type LauncherConfiguration = {
  entrypointPath: string;
  bridgePath: string;
  helpersPath: string;
  sourcemapSupportPath: string;
  shouldAddHelpers?: boolean;
  shouldAddSourcemapSupport?: boolean;
};

export function makeLauncher({
  entrypointPath,
  bridgePath,
  helpersPath,
  sourcemapSupportPath,
  shouldAddHelpers = false,
  shouldAddSourcemapSupport = false,
}: LauncherConfiguration): string {
  return `const { Bridge } = require("${bridgePath}");
const { Server } = require("http");
${shouldAddSourcemapSupport ? `require("${sourcemapSupportPath}");\n` : ''}
let isServerListening = false;
let bridge = new Bridge();
const saveListen = Server.prototype.listen;
Server.prototype.listen = function listen() {
  isServerListening = true;
  console.log('Legacy server listening...');
  bridge.setServer(this);
  Server.prototype.listen = saveListen;
  return bridge.listen();
};

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV =
    process.env.NOW_REGION === 'dev1' ? 'development' : 'production';
}

try {
  let listener = require("${entrypointPath}");
  if (listener.default) listener = listener.default;

  if (typeof listener.listen === 'function') {
    Server.prototype.listen = saveListen;
    const server = listener;
    bridge.setServer(server);
    bridge.listen();
  } else if (typeof listener === 'function') {
    Server.prototype.listen = saveListen;
    let server;
    ${
      shouldAddHelpers
        ? [
            'bridge = new Bridge(undefined, true);',
            `server = require("${helpersPath}").createServerWithHelpers(listener, bridge);`,
          ].join('\n')
        : ['server = require("http").createServer(listener);'].join('\n')
    }
    bridge.setServer(server);
    bridge.listen();
  } else if (typeof listener === 'object' && Object.keys(listener).length === 0) {
    setTimeout(() => {
      if (!isServerListening) {
        console.error('No exports found in module "${entrypointPath}".');
        console.error('Did you forget to export a function or a server?');
        process.exit(1);
      }
    }, 5000);
  } else {
    console.error('Invalid export found in module "${entrypointPath}".');
    console.error('The default export must be a function or server.');
  }
} catch (err) {
  if (err.code === 'MODULE_NOT_FOUND') {
    console.error(err.message);
    console.error('Did you forget to add it to "dependencies" in \`package.json\`?');
    process.exit(1);
  } else {
    console.error(err);
    process.exit(1);
  }
}

exports.launcher = bridge.launcher;`;
}
