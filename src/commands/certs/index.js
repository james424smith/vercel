//
import chalk from 'chalk';

import { handleError } from '../../util/error';

import createOutput from '../../util/output';
import getArgs from '../../util/get-args';
import getSubcommand from '../../util/get-subcommand';
import logo from '../../util/output/logo';

import add from './add';
import issue from './issue';
import ls from './ls';
import rm from './rm';

const help = () => {
  console.log(`
  ${chalk.bold(`${logo} now certs`)} [options] <command>

  ${chalk.yellow('NOTE:')} This command is intended for advanced use only.
  By default, Now manages your certificates automatically.

  ${chalk.dim('Commands:')}

    ls                        Show all available certificates
    issue      <cn> [<cn>]    Issue a new certificate for a domain
    rm         <id>           Remove a certificate by id

  ${chalk.dim('Options:')}

    -h, --help                     Output usage information
    -A ${chalk.bold.underline('FILE')}, --local-config=${chalk.bold.underline(
    'FILE'
  )}   Path to the local ${'`now.json`'} file
    -Q ${chalk.bold.underline('DIR')}, --global-config=${chalk.bold.underline(
    'DIR'
  )}    Path to the global ${'`.now`'} directory
    -d, --debug                    Debug mode [off]
    -t ${chalk.bold.underline('TOKEN')}, --token=${chalk.bold.underline(
    'TOKEN'
  )}        Login token
    -S, --scope                    Set a custom scope
    --challenge-only               Only show challenges needed to issue a cert
    --crt ${chalk.bold.underline('FILE')}                     Certificate file
    --key ${chalk.bold.underline(
      'FILE'
    )}                     Certificate key file
    --ca ${chalk.bold.underline(
      'FILE'
    )}                      CA certificate chain file

  ${chalk.dim('Examples:')}

  ${chalk.gray(
    '–'
  )} Generate a certificate with the cnames "acme.com" and "www.acme.com"

      ${chalk.cyan('$ now certs issue acme.com www.acme.com')}

  ${chalk.gray('–')} Remove a certificate

      ${chalk.cyan('$ now certs rm id')}
  `);
};

const COMMAND_CONFIG = {
  add: ['add'],
  issue: ['issue'],
  ls: ['ls', 'list'],
  renew: ['renew'],
  rm: ['rm', 'remove']
};

export default async function main(ctx) {
  let argv;

  try {
    argv = getArgs(ctx.argv.slice(2), {
      '--challenge-only': Boolean,
      '--overwrite': Boolean,
      '--output': String,
      '--crt': String,
      '--key': String,
      '--ca': String
    });
  } catch (err) {
    handleError(err);
    return 1;
  }

  if (argv['--help']) {
    help();
    return 0;
  }

  const output = createOutput({ debug: argv['--debug'] });
  const { subcommand, args } = getSubcommand(argv._.slice(1), COMMAND_CONFIG);
  switch (subcommand) {
    case 'issue':
      return issue(ctx, argv, args, output);
    case 'ls':
      return ls(ctx, argv, args, output);
    case 'rm':
      return rm(ctx, argv, args, output);
    case 'add':
      return add(ctx, argv, args, output);
    case 'renew':
      output.error('Renewing certificates is deprecated, issue a new one.');
      return 1;
    default:
      output.error('Please specify a valid subcommand: ls | issue | rm');
      help();
      return 2;
  }
}
