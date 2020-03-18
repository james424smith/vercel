import fs from 'fs-extra';
import { resolve, basename, parse, join } from 'path';
import Client from '../../util/client.ts';
import getScope from '../../util/get-scope.ts';
import createOutput from '../../util/output';
import code from '../../util/output/code';
import highlight from '../../util/output/highlight';
import param from '../../util/output/param.ts';
import { readLocalConfig } from '../../util/config/files';
import getArgs from '../../util/get-args';
import * as parts from './args';
import { handleError } from '../../util/error';
import readPackage from '../../util/read-package';
import preferV2Deployment, {
  hasDockerfile,
  hasServerfile,
} from '../../util/prefer-v2-deployment';
import getProjectName from '../../util/get-project-name';

export default async ctx => {
  const {
    authConfig,
    config: { currentTeam },
    apiUrl,
  } = ctx;
  const combinedArgs = Object.assign({}, parts.legacyArgs, parts.latestArgs);

  let platformVersion = null;
  let contextName = currentTeam || 'current user';
  let argv = null;

  try {
    argv = getArgs(ctx.argv.slice(2), combinedArgs);
  } catch (error) {
    handleError(error);
    return 1;
  }

  if (argv._[0] === 'deploy') {
    argv._.shift();
  }

  let paths = [];

  if (argv._.length > 0) {
    // If path is relative: resolve
    // if path is absolute: clear up strange `/` etc
    paths = argv._.map(item => resolve(process.cwd(), item));
  } else {
    paths = [process.cwd()];
  }

  let { localConfig } = ctx;
  if (!localConfig || localConfig instanceof Error) {
    localConfig = readLocalConfig(paths[0]);
  }
  const debugEnabled = argv['--debug'];
  const output = createOutput({ debug: debugEnabled });
  const stats = {};
  const versionFlag = argv['--platform-version'];

  if (argv['--help']) {
    const lastArg = argv._[argv._.length - 1];
    const help = lastArg === 'deploy-v1' ? parts.legacyHelp : parts.latestHelp;

    output.print(help());
    return 2;
  }

  for (const path of paths) {
    try {
      stats[path] = await fs.lstat(path);
    } catch (err) {
      const { ext } = parse(path);

      if (versionFlag === 1 && !ext) {
        // This will ensure `-V 1 zeit/serve` (GitHub deployments) work. Since
        // GitHub repositories are never just one file, we need to set
        // the `isFile` property accordingly.
        stats[path] = {
          isFile: () => false,
        };
      } else {
        output.error(
          `The specified file or directory "${basename(path)}" does not exist.`
        );
        return 1;
      }
    }
  }

  let client = null;

  const isFile = Object.keys(stats).length === 1 && stats[paths[0]].isFile();

  if (authConfig && authConfig.token) {
    client = new Client({
      apiUrl,
      token: authConfig.token,
      currentTeam,
      debug: debugEnabled,
    });
    try {
      ({ contextName, platformVersion } = await getScope(client));
    } catch (err) {
      if (err.code === 'NOT_AUTHORIZED' || err.code === 'TEAM_DELETED') {
        output.error(err.message);
        return 1;
      }

      throw err;
    }
  }

  const file = highlight('now.json');
  const prop = code('version');

  if (localConfig) {
    const { version } = localConfig;

    if (version) {
      if (typeof version === 'number') {
        if (version !== 1 && version !== 2) {
          const first = code(1);
          const second = code(2);

          output.error(
            `The value of the ${prop} property within ${file} can only be ${first} or ${second}.`
          );
          return 1;
        }

        platformVersion = version;
      } else {
        output.error(
          `The ${prop} property inside your ${file} file must be a number.`
        );
        return 1;
      }
    }
  }

  if (versionFlag) {
    if (versionFlag !== 1 && versionFlag !== 2) {
      output.error(
        `The ${param('--platform-version')} option must be either ${code(
          '1'
        )} or ${code('2')}.`
      );
      return 1;
    }

    platformVersion = versionFlag;
  }

  if (
    platformVersion === 1 &&
    versionFlag !== 1 &&
    !argv['--docker'] &&
    !argv['--npm']
  ) {
    // Only check when it was not set via CLI flag
    const reason = await preferV2Deployment({
      client,
      localConfig,
      projectName: getProjectName({
        argv,
        nowConfig: localConfig || {},
        isFile,
        paths,
      }),
      hasServerfile: await hasServerfile(paths[0]),
      hasDockerfile: await hasDockerfile(paths[0]),
      pkg: await readPackage(join(paths[0], 'package.json')),
    });

    if (reason) {
      output.note(reason);
      platformVersion = 2;
    }
  }

  if (platformVersion === null || platformVersion > 1) {
    return require('./latest').default(
      ctx,
      contextName,
      output,
      stats,
      localConfig,
      parts.latestArgs
    );
  }

  return require('./legacy').default(
    ctx,
    contextName,
    output,
    parts.legacyArgsMri
  );
};
