import chalk from 'chalk';
import { NowContext } from '../../types';
import createOutput from '../../util/output';
import getArgs from '../../util/get-args';
import getSubcommand from '../../util/get-subcommand';
import handleError from '../../util/handle-error';
import logo from '../../util/output/logo';
import { getPkgName } from '../../util/pkg-name';
import setupAndLink from '../../util/link/setup-and-link';

const help = () => {
  console.log(`
  ${chalk.bold(`${logo} ${getPkgName()} link`)} [options]

  ${chalk.dim('Options:')}

    -h, --help                     Output usage information
    -A ${chalk.bold.underline('FILE')}, --local-config=${chalk.bold.underline(
    'FILE'
  )}   Path to the local ${'`vercel.json`'} file
    -Q ${chalk.bold.underline('DIR')}, --global-config=${chalk.bold.underline(
    'DIR'
  )}    Path to the global ${'`.vercel`'} directory
    -d, --debug                    Debug mode [off]
    -t ${chalk.bold.underline('TOKEN')}, --token=${chalk.bold.underline(
    'TOKEN'
  )}        Login token
  --confirm                  Confirm default options and skip questions

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Link current directory to a Vercel Project

      ${chalk.cyan(`$ ${getPkgName()} link`)}

  ${chalk.gray(
    '–'
  )} Link current directory with default options and skip questions

      ${chalk.cyan(`$ ${getPkgName()} link --confirm`)}
`);
};

const COMMAND_CONFIG = {
  // No subcommands yet
};

export default async function main(ctx: NowContext) {
  let argv;

  try {
    argv = getArgs(ctx.argv.slice(2), {
      '--confirm': Boolean,
    });
  } catch (error) {
    handleError(error);
    return 1;
  }

  if (argv['--help']) {
    help();
    return 2;
  }

  const debug = argv['--debug'];
  const output = createOutput({ debug });
  const { args } = getSubcommand(argv._.slice(1), COMMAND_CONFIG);
  const path = args[0] || process.cwd();
  const autoConfirm = argv['--confirm'];
  const forceDelete = true;

  const link = await setupAndLink(
    ctx,
    output,
    path,
    forceDelete,
    autoConfirm,
    'success'
  );

  if (link.status === 'error') {
    return link.exitCode;
  } else if (link.status === 'not_linked') {
    // User aborted project linking questions
    return 0;
  } else if (link.status === 'linked') {
    // Successfully linked
    return 0;
  } else {
    const err: never = link;
    throw new Error('Unknown link status: ' + err);
  }
}
