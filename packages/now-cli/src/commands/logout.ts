import chalk from 'chalk';
import fetch from 'node-fetch';
import logo from '../util/output/logo';
import { handleError } from '../util/error';
import {
  readConfigFile,
  writeToConfigFile,
  readAuthConfigFile,
  writeToAuthConfigFile,
} from '../util/config/files';
import getArgs from '../util/get-args';
import { NowContext } from '../types';
import createOutput, { Output } from '../util/output';

const help = () => {
  console.log(`
  ${chalk.bold(`${logo} now logout`)}

  ${chalk.dim('Options:')}

    -h, --help                     Output usage information
    -A ${chalk.bold.underline('FILE')}, --local-config=${chalk.bold.underline(
    'FILE'
  )}   Path to the local ${'`now.json`'} file
    -Q ${chalk.bold.underline('DIR')}, --global-config=${chalk.bold.underline(
    'DIR'
  )}    Path to the global ${'`.now`'} directory

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Logout from the CLI:

    ${chalk.cyan('$ now logout')}
`);
};

export default async function main(ctx: NowContext): Promise<number> {
  let argv;

  try {
    argv = getArgs(ctx.argv.slice(2), {
      '--help': Boolean,
      '-h': '--help',
    });
  } catch (err) {
    handleError(err);
    return 1;
  }

  if (argv['--help']) {
    help();
    return 2;
  }

  const debugEnabled = argv['--debug'];
  const output = createOutput({ debug: debugEnabled });
  return logout(ctx.apiUrl, output);
}

const logout = async (apiUrl: string, output: Output) => {
  const spinner = output.spinner('Logging out...', 200);

  const configContent = readConfigFile();
  const authContent = readAuthConfigFile();

  // Copy the content
  const token = `${authContent.token}`;

  delete configContent.currentTeam;

  // The new user might have completely different teams, so
  // we should wipe the order.
  if (configContent.desktop) {
    delete configContent.desktop.teamOrder;
  }

  delete authContent.token;

  try {
    writeToConfigFile(configContent);
    writeToAuthConfigFile(authContent);
    output.debug('Configuration has been deleted');
  } catch (err) {
    spinner();
    output.error(`Couldn't remove config while logging out`);
    return 1;
  }

  const res = await fetch(`${apiUrl}/v3/user/tokens/current`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 403) {
    output.debug('Token is invalid so it cannot be revoked');
  } else if (res.status !== 200) {
    spinner();
    const err = await res.json();
    output.error('Failed to revoke token');
    output.debug(err ? err.message : '');
    return 1;
  }

  spinner();
  output.log('Logged out!');
  return 0;
};
