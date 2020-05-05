import chalk from 'chalk';

import { NowContext } from '../../types';
import createOutput from '../../util/output';
import getArgs from '../../util/get-args';
import getSubcommand from '../../util/get-subcommand';
import handleError from '../../util/handle-error';
import logo from '../../util/output/logo';

import add from './add';
import buy from './buy';
import transferIn from './transfer-in';
import inspect from './inspect';
import ls from './ls';
import rm from './rm';
import verify from './verify';
import move from './move';
import { getPkgName } from '../../util/pkg-name';

const help = () => {
  console.log(`
  ${chalk.bold(`${logo} ${getPkgName()} domains`)} [options] <command>

  ${chalk.dim('Commands:')}

    ls                                  Show all domains in a list
    inspect      [name]                 Displays information related to a domain
    add          [name]                 Add a new domain that you already own
    rm           [name]                 Remove a domain
    buy          [name]                 Buy a domain that you don't yet own
    move         [name] [destination]   Move a domain to another user or team.
    transfer-in  [name]                 Transfer in a domain to Vercel
    verify       [name]                 Run a verification for a domain

  ${chalk.dim('Options:')}

    -h, --help                     Output usage information
    -d, --debug                    Debug mode [off]
    -A ${chalk.bold.underline('FILE')}, --local-config=${chalk.bold.underline(
    'FILE'
  )}   Path to the local ${'`vercel.json`'} file
    -Q ${chalk.bold.underline('DIR')}, --global-config=${chalk.bold.underline(
    'DIR'
  )}    Path to the global ${'`.vercel`'} directory
    -t ${chalk.bold.underline('TOKEN')}, --token=${chalk.bold.underline(
    'TOKEN'
  )}        Login token
    -S, --scope                    Set a custom scope
    -N, --next                     Show next page of results

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Add a domain that you already own

      ${chalk.cyan(
        `$ ${getPkgName()} domains add ${chalk.underline('domain-name.com')}`
      )}

      Make sure the domain's DNS nameservers are at least 2 of the
      ones listed on ${chalk.underline('https://vercel.com/edge-network')}.

      ${chalk.yellow('NOTE:')} Running ${chalk.dim(
    `${getPkgName()} alias`
  )} will automatically register your domain
      if it's configured with these nameservers (no need to ${chalk.dim(
        '`domain add`'
      )}).

  ${chalk.gray('–')} Paginate results, where ${chalk.dim(
    '`1584722256178`'
  )} is the time in milliseconds since the UNIX epoch.

      ${chalk.cyan(`$ ${getPkgName()} domains ls --next 1584722256178`)}
`);
};

const COMMAND_CONFIG = {
  add: ['add'],
  buy: ['buy'],
  inspect: ['inspect'],
  ls: ['ls', 'list'],
  move: ['move'],
  rm: ['rm', 'remove'],
  transferIn: ['transfer-in'],
  verify: ['verify'],
};

export default async function main(ctx: NowContext) {
  let argv;

  try {
    argv = getArgs(ctx.argv.slice(2), {
      '--cdn': Boolean,
      '--code': String,
      '--no-cdn': Boolean,
      '--yes': Boolean,
      '--next': Number,
      '-N': '--next',
    });
  } catch (error) {
    handleError(error);
    return 1;
  }

  if (argv['--help']) {
    help();
    return 2;
  }

  const output = createOutput({ debug: argv['--debug'] });
  const { subcommand, args } = getSubcommand(argv._.slice(1), COMMAND_CONFIG);
  switch (subcommand) {
    case 'add':
      return add(ctx, argv, args, output);
    case 'inspect':
      return inspect(ctx, argv, args, output);
    case 'move':
      return move(ctx, argv, args, output);
    case 'buy':
      return buy(ctx, argv, args, output);
    case 'rm':
      return rm(ctx, argv, args, output);
    case 'transferIn':
      return transferIn(ctx, argv, args, output);
    case 'verify':
      return verify(ctx, argv, args, output);
    default:
      return ls(ctx, argv, args, output);
  }
}
