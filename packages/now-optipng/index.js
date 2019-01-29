const FileBlob = require('@now/build-utils/file-blob.js'); // eslint-disable-line import/no-extraneous-dependencies
const OptiPng = require('optipng');
const pipe = require('multipipe');

exports.analyze = ({ files, entrypoint }) => files[entrypoint].digest;

exports.build = async ({ files, entrypoint }) => {
  const optimizer = new OptiPng(['-o9']);
  const stream = pipe(
    files[entrypoint].toStream(),
    optimizer,
  );
  const result = await FileBlob.fromStream({ stream });
  return { [entrypoint]: result };
};
