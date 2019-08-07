/* disable this rule _here_ to avoid conflict with ongoing changes */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import ms from 'ms';
import bytes from 'bytes';
import { delimiter, dirname, join } from 'path';
import { fork, ChildProcess } from 'child_process';
import { createFunction } from '@zeit/fun';
import { File, Lambda, FileBlob, FileFsRef } from '@now/build-utils';
import stripAnsi from 'strip-ansi';
import chalk from 'chalk';
import which from 'which';
import plural from 'pluralize';
import ora, { Ora } from 'ora';
import minimatch from 'minimatch';

import { Output } from '../output';
import highlight from '../output/highlight';
import { relative } from '../path-helpers';
import { LambdaSizeExceededError } from '../errors-ts';

import DevServer from './server';
import { builderModulePathPromise, getBuilder } from './builder-cache';
import {
  EnvConfig,
  NowConfig,
  BuildConfig,
  BuildMatch,
  BuildResult,
  BuilderInputs,
  BuilderOutput,
  BuilderOutputs
} from './types';

interface BuildMessage {
  type: string;
}

interface BuildMessageResult extends BuildMessage {
  type: 'buildResult';
  result?: BuilderOutputs | BuildResult;
  error?: object;
}

const isLogging = new WeakSet<ChildProcess>();

let nodeBinPromise: Promise<string>;

async function getNodeBin(): Promise<string> {
  return which.sync('node', { nothrow: true }) || process.execPath;
}

function pipeChildLogging(child: ChildProcess): void {
  if (!isLogging.has(child)) {
    child.stdout!.pipe(process.stdout);
    child.stderr!.pipe(process.stderr);
    isLogging.add(child);
  }
}

async function createBuildProcess(
  match: BuildMatch,
  buildEnv: EnvConfig,
  workPath: string,
  output: Output,
  yarnPath?: string
): Promise<ChildProcess> {
  if (!nodeBinPromise) {
    nodeBinPromise = getNodeBin();
  }
  const [execPath, modulePath] = await Promise.all([
    nodeBinPromise,
    builderModulePathPromise
  ]);
  let PATH = `${dirname(execPath)}${delimiter}${process.env.PATH}`;
  if (yarnPath) {
    PATH = `${yarnPath}${delimiter}${PATH}`;
  }
  const buildProcess = fork(modulePath, [], {
    cwd: workPath,
    env: {
      ...process.env,
      PATH,
      ...buildEnv,
      NOW_REGION: 'dev1'
    },
    execPath,
    execArgv: [],
    stdio: ['ignore', 'pipe', 'pipe', 'ipc']
  });
  match.buildProcess = buildProcess;

  buildProcess.on('exit', (code, signal) => {
    output.debug(
      `Build process for ${match.src} exited with ${signal || code}`
    );
    match.buildProcess = undefined;
  });

  buildProcess.stdout!.setEncoding('utf8');
  buildProcess.stderr!.setEncoding('utf8');

  return new Promise((resolve, reject) => {
    // The first message that the builder process sends is the `ready` event
    buildProcess.once('message', ({ type }) => {
      if (type !== 'ready') {
        reject(new Error('Did not get "ready" event from builder'));
      } else {
        resolve(buildProcess);
      }
    });
  });
}

export async function executeBuild(
  nowConfig: NowConfig,
  devServer: DevServer,
  files: BuilderInputs,
  match: BuildMatch,
  requestPath: string | null,
  isInitialBuild: boolean,
  filesChanged?: string[],
  filesRemoved?: string[]
): Promise<void> {
  const {
    builderWithPkg: { runInProcess, builder, package: pkg }
  } = match;
  const { src: entrypoint } = match;
  const { env, debug, buildEnv, yarnPath, cwd: workPath } = devServer;

  const startTime = Date.now();
  const showBuildTimestamp =
    match.use !== '@now/static' && (!isInitialBuild || debug);

  if (showBuildTimestamp) {
    devServer.output.log(`Building ${match.use}:${entrypoint}`);
    devServer.output.debug(
      `Using \`${pkg.name}${pkg.version ? `@${pkg.version}` : ''}\``
    );
  }

  const config = match.config || {};

  let result: BuildResult;

  let { buildProcess } = match;
  if (!runInProcess && !buildProcess) {
    devServer.output.debug(`Creating build process for ${entrypoint}`);
    buildProcess = await createBuildProcess(
      match,
      buildEnv,
      workPath,
      devServer.output,
      yarnPath
    );
  }

  const buildParams = {
    files,
    entrypoint,
    workPath,
    config,
    meta: {
      isDev: true,
      requestPath,
      filesChanged,
      filesRemoved,
      env,
      buildEnv
    }
  };

  let buildResultOrOutputs: BuilderOutputs | BuildResult;
  if (buildProcess) {
    let spinLogger;
    let spinner: Ora | undefined;
    const fullLogs: string[] = [];

    if (isInitialBuild && !debug && process.stdout.isTTY) {
      const logTitle = `${chalk.bold(
        `Preparing ${chalk.underline(entrypoint)} for build`
      )}:`;
      spinner = ora(logTitle).start();

      spinLogger = (data: Buffer) => {
        const rawLog = stripAnsi(data.toString());
        fullLogs.push(rawLog);

        const lines = rawLog.replace(/\s+$/, '').split('\n');
        const spinText = `${logTitle} ${lines[lines.length - 1]}`;
        const maxCols = process.stdout.columns || 80;
        const overflow = stripAnsi(spinText).length + 2 - maxCols;
        spinner!.text =
          overflow > 0 ? `${spinText.slice(0, -overflow - 3)}...` : spinText;
      };

      buildProcess!.stdout!.on('data', spinLogger);
      buildProcess!.stderr!.on('data', spinLogger);
    } else {
      pipeChildLogging(buildProcess!);
    }

    try {
      buildProcess.send({
        type: 'build',
        builderName: pkg.name,
        buildParams
      });

      buildResultOrOutputs = await new Promise((resolve, reject) => {
        function onMessage({ type, result, error }: BuildMessageResult) {
          cleanup();
          if (type === 'buildResult') {
            if (result) {
              resolve(result);
            } else if (error) {
              reject(Object.assign(new Error(), error));
            }
          } else {
            reject(new Error(`Got unexpected message type: ${type}`));
          }
        }
        function onExit(code: number | null, signal: string | null) {
          cleanup();
          const err = new Error(
            `Builder exited with ${signal || code} before sending build result`
          );
          reject(err);
        }
        function cleanup() {
          buildProcess!.removeListener('exit', onExit);
          buildProcess!.removeListener('message', onMessage);
        }
        buildProcess!.on('exit', onExit);
        buildProcess!.on('message', onMessage);
      });
    } catch (err) {
      if (spinner) {
        spinner.stop();
        spinner = undefined;
        console.log(fullLogs.join(''));
      }
      throw err;
    } finally {
      if (spinLogger) {
        buildProcess.stdout!.removeListener('data', spinLogger);
        buildProcess.stderr!.removeListener('data', spinLogger);
      }
      if (spinner) {
        spinner.stop();
      }
      pipeChildLogging(buildProcess!);
    }
  } else {
    buildResultOrOutputs = await builder.build(buildParams);
  }

  // Sort out build result to builder v2 shape
  if (builder.version === undefined) {
    // `BuilderOutputs` map was returned (Now Builder v1 behavior)
    result = {
      output: buildResultOrOutputs as BuilderOutputs,
      routes: [],
      watch: []
    };
  } else {
    result = buildResultOrOutputs as BuildResult;
  }

  // Convert the JSON-ified output map back into their corresponding `File`
  // subclass type instances.
  const output = result.output as BuilderOutputs;
  for (const name of Object.keys(output)) {
    const obj = output[name] as File;
    let lambda: Lambda;
    let fileRef: FileFsRef;
    let fileBlob: FileBlob;
    switch (obj.type) {
      case 'FileFsRef':
        fileRef = Object.assign(Object.create(FileFsRef.prototype), obj);
        output[name] = fileRef;
        break;
      case 'FileBlob':
        fileBlob = Object.assign(Object.create(FileBlob.prototype), obj);
        fileBlob.data = Buffer.from((obj as any).data.data);
        output[name] = fileBlob;
        break;
      case 'Lambda':
        lambda = Object.assign(Object.create(Lambda.prototype), obj) as Lambda;
        // Convert the JSON-ified Buffer object back into an actual Buffer
        lambda.zipBuffer = Buffer.from((obj as any).zipBuffer.data);
        output[name] = lambda;
        break;
      default:
        throw new Error(`Unknown file type: ${obj.type}`);
    }
  }

  // The `watch` array must not have "./" prefix, so if the builder returned
  // watched files that contain "./" strip them here for ease of writing the
  // builder.
  result.watch = (result.watch || []).map((w: string) => {
    if (w.startsWith('./')) {
      return w.substring(2);
    }
    return w;
  });

  // The `entrypoint` should always be watched, since we know that it was used
  // to produce the build output. This is for builders that don't implement
  // a fully featured `watch` return value.
  if (!result.watch.includes(entrypoint)) {
    result.watch.push(entrypoint);
  }

  // Enforce the lambda zip size soft watermark
  const maxLambdaBytes = bytes('50mb');
  for (const asset of Object.values(result.output)) {
    if (asset.type === 'Lambda') {
      const size = asset.zipBuffer.length;
      if (size > maxLambdaBytes) {
        throw new LambdaSizeExceededError(size, maxLambdaBytes);
      }
    }
  }

  // Create function for all 'Lambda' type output
  await Promise.all(
    Object.entries(result.output).map(async entry => {
      const path: string = entry[0];
      const asset: BuilderOutput = entry[1];

      if (asset.type === 'Lambda') {
        // Tear down the previous `fun` Lambda instance for this asset
        const oldAsset = match.buildOutput && match.buildOutput[path];
        if (oldAsset && oldAsset.type === 'Lambda' && oldAsset.fn) {
          await oldAsset.fn.destroy();
        }

        asset.fn = await createFunction({
          Code: { ZipFile: asset.zipBuffer },
          Handler: asset.handler,
          Runtime: asset.runtime,
          MemorySize: 3008,
          Environment: {
            Variables: {
              ...nowConfig.env,
              ...asset.environment,
              ...env,
              NOW_REGION: 'dev1'
            }
          }
        });
      }

      match.buildTimestamp = Date.now();
    })
  );

  match.buildResults.set(requestPath, result);
  Object.assign(match.buildOutput, result.output);

  if (showBuildTimestamp) {
    const endTime = Date.now();
    devServer.output.log(
      `Built ${match.use}:${entrypoint} [${ms(endTime - startTime)}]`
    );
  }
}

export async function getBuildMatches(
  nowConfig: NowConfig,
  cwd: string,
  yarnDir: string,
  output: Output,
  fileList: string[]
): Promise<BuildMatch[]> {
  const matches: BuildMatch[] = [];

  if (fileList.length === 0) {
    // If there's no files in the cwd then we know there won't be any build
    // matches, so bail eagerly, and avoid printing the "no matches" message.
    return matches;
  }

  const noMatches: BuildConfig[] = [];
  const builds = nowConfig.builds || [{ src: '**', use: '@now/static' }];

  for (const buildConfig of builds) {
    let { src, use } = buildConfig;

    if (!use) {
      continue;
    }

    if (src[0] === '/') {
      // Remove a leading slash so that the globbing is relative to `cwd`
      // instead of the root of the filesystem. This matches the behavior
      // of Now deployments.
      src = src.substring(1);
    }

    // We need to escape brackets since `glob` will
    // try to find a group otherwise
    src = src.replace(/(\[|\])/g, '[$1]');

    const files = fileList
      .filter(name => name === src || minimatch(name, src))
      .map(name => join(cwd, name));

    if (files.length === 0) {
      noMatches.push(buildConfig);
    }

    for (const file of files) {
      src = relative(cwd, file);
      const builderWithPkg = await getBuilder(use, yarnDir, output);
      matches.push({
        ...buildConfig,
        src,
        builderWithPkg,
        buildOutput: {},
        buildResults: new Map(),
        buildTimestamp: 0
      });
    }
  }

  if (noMatches.length > 0) {
    output.warn(
      `You defined ${plural(
        'build',
        noMatches.length,
        true
      )} that did not match any source files (please ensure they are NOT defined in ${highlight(
        '.nowignore'
      )}):`
    );
    for (const buildConfig of noMatches) {
      output.print(`- ${JSON.stringify(buildConfig)}\n`);
    }
  }

  return matches;
}
