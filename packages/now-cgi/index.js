const path = require('path');
const { mkdirp, copyFile } = require('fs-extra');

const {
  glob,
  debug,
  download,
  shouldServe,
  createLambda,
  getWritableDirectory,
} = require('@now/build-utils');

exports.analyze = ({ files, entrypoint }) => files[entrypoint].digest;

exports.version = 3;

exports.build = async ({ workPath, files, entrypoint, meta, config }) => {
  const outDir = await getWritableDirectory();

  await download(files, workPath, meta);

  const handlerPath = path.join(__dirname, 'handler');
  await copyFile(handlerPath, path.join(outDir, 'handler'));

  const entrypointOutDir = path.join(outDir, path.dirname(entrypoint));
  await mkdirp(entrypointOutDir);

  // For now only the entrypoint file is copied into the lambda
  await copyFile(
    path.join(workPath, entrypoint),
    path.join(outDir, entrypoint)
  );

  const lambda = await createLambda({
    files: await glob('**', outDir),
    handler: 'handler',
    runtime: 'go1.x',
    environment: {
      SCRIPT_FILENAME: entrypoint,
    },
  });

  return { output: lambda };
};

exports.shouldServe = shouldServe;
