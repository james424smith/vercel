import chalk from 'chalk';
import { NowContext } from '../../types';
import { Output } from '../../util/output';
import Client from '../../util/client';
import getScope from '../../util/get-scope';
import { DomainNotFound, InvalidDomain } from '../../util/errors-ts';
import stamp from '../../util/output/stamp';
import importZonefile from '../../util/dns/import-zonefile';

type Options = {
  '--debug': boolean;
};

export default async function add(
  ctx: NowContext,
  opts: Options,
  args: string[],
  output: Output
) {
  const { authConfig: { token }, config } = ctx;
  const { currentTeam } = config;
  const { apiUrl } = ctx;
  const debug = opts['--debug'];
  const client = new Client({ apiUrl, token, currentTeam, debug });
  let contextName = null;

  try {
    ({ contextName } = await getScope(client));
  } catch (err) {
    if (err.code === 'NOT_AUTHORIZED') {
      output.error(err.message);
      return 1;
    }

    throw err;
  }

  if (args.length !== 2) {
    output.error(
      `Invalid number of arguments. Usage: ${chalk.cyan(
        '`now dns import <domain> <zonefile>`'
      )}`
    );
    return 1;
  }

  const addStamp = stamp();
  const [domain, zonefilePath] = args;

  const recordIds = await importZonefile(client, contextName, domain, zonefilePath);
  if (recordIds instanceof DomainNotFound) {
    output.error(
      `The domain ${domain} can't be found under ${chalk.bold(
        contextName
      )} ${chalk.gray(addStamp())}`
    );
    return 1;
  }

  if (recordIds instanceof InvalidDomain) {
    output.error(
      `The domain ${domain} doesn't match with the one found in the Zone file ${
        chalk.gray(addStamp())
      }`
    );
    return 1;
  }

  console.log(
    `${chalk.cyan('> Success!')} ${recordIds.length} DNS records for domain ${chalk.bold(
      domain
    )} created under ${chalk.bold(
      contextName
    )} ${chalk.gray(addStamp())}`
  );
  return 0;
}
