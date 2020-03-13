import path from 'path';
import chalk from 'chalk';
import { PackageJson } from '@now/build-utils';

import getArgs from '../../util/get-args';
import getSubcommand from '../../util/get-subcommand';
import { NowContext } from '../../types';
import { NowError } from '../../util/now-error';
import handleError from '../../util/handle-error';
import createOutput from '../../util/output/create-output';
import logo from '../../util/output/logo';
import cmd from '../../util/output/cmd';
import dev from './dev';
import readPackage from '../../util/read-package';
import readConfig from '../../util/config/read-config';

const COMMAND_CONFIG = {
  dev: ['dev'],
};

const help = () => {
  console.log(`
  ${chalk.bold(`${logo} now dev`)} [options] <dir>

  Starts the \`now dev\` server.

  ${chalk.dim('Options:')}

    -h, --help             Output usage information
    -d, --debug            Debug mode [off]
    -l, --listen  [uri]    Specify a URI endpoint on which to listen [0.0.0.0:3000]
    -t, --token   [token]  Specify an Authorization Token

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Start the \`now dev\` server on port 8080

      ${chalk.cyan('$ now dev --listen 8080')}

  ${chalk.gray('–')} Make the \`now dev\` server bind to localhost on port 5000

      ${chalk.cyan('$ now dev --listen 127.0.0.1:5000')}
  `);
};

export default async function main(ctx: NowContext) {
  let argv;
  let args;
  let output;

  try {
    argv = getArgs(ctx.argv.slice(2), {
      '--listen': String,
      '-l': '--listen',

      // Deprecated
      '--port': Number,
      '-p': '--port',
    });
    const debug = argv['--debug'];
    args = getSubcommand(argv._.slice(1), COMMAND_CONFIG).args;
    output = createOutput({ debug });

    if ('--port' in argv) {
      output.warn('`--port` is deprecated, please use `--listen` instead');
      argv['--listen'] = String(argv['--port']);
    }
  } catch (err) {
    handleError(err);
    return 1;
  }

  if (argv['--help']) {
    help();
    return 2;
  }

  const [dir = '.'] = args;

  const nowJson = await readConfig(path.join(dir, 'now.json'));
  // @ts-ignore: Because `nowJson` could be one of three different types
  const hasBuilds = nowJson && nowJson.builds && nowJson.builds.length > 0;

  if (!nowJson || !hasBuilds) {
    const pkg = await readPackage(path.join(dir, 'package.json'));

    if (pkg) {
      const { scripts } = pkg as PackageJson;

      if (scripts && scripts.dev && /\bnow\b\W+\bdev\b/.test(scripts.dev)) {
        output.error(
          `The ${cmd('dev')} script in ${cmd(
            'package.json'
          )} must not contain ${cmd('now dev')}`
        );
        output.error(`More details: http://err.sh/now/now-dev-as-dev-script`);
        return 1;
      }
    }
  }

  if (argv._.length > 2) {
    output.error(`${cmd('now dev [dir]')} accepts at most one argument`);
    return 1;
  }

  try {
    return await dev(ctx, argv, args, output);
  } catch (err) {
    output.error(err.message);
    output.debug(stringifyError(err));
    return 1;
  }
}

// stringify error details for inspecting
function stringifyError(err: any) {
  if (err instanceof NowError) {
    const errMeta = JSON.stringify(err.meta, null, 2).replace(/\\n/g, '\n');
    return `${chalk.red(err.code)} ${err.message}\n${errMeta}`;
  }
  return err.stack;
}
