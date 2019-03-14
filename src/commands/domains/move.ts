import chalk from 'chalk';
import plural from 'pluralize';

import { NowContext } from '../../types';
import { Output } from '../../util/output';
import * as ERRORS from '../../util/errors-ts';
import Client from '../../util/client';
import cmd from '../../util/output/cmd';
import getScope from '../../util/get-scope';
import withSpinner from '../../util/with-spinner';
import moveOutDomain from '../../util/domains/move-out-domain';
import isRootDomain from '../../util/is-root-domain';
import textInput from '../../util/input/text';
import param from '../../util/output/param';
import getDomainAliases from '../../util/alias/get-domain-aliases';
import getDomainByName from '../../util/domains/get-domain-by-name';
import promptBool from '../../util/input/prompt-bool';

type Options = {
  '--debug': boolean;
  '--yes': boolean;
};

export default async function move(
  ctx: NowContext,
  opts: Options,
  args: string[],
  output: Output
) {
  const {
    authConfig: { token },
    config
  } = ctx;
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

  const { domainName, destination } = await getArgs(args);
  if (!isRootDomain(domainName)) {
    output.error(
      `Invalid domain name "${domainName}". Run ${cmd('now domains --help')}`
    );
    return 1;
  }

  const domain = await getDomainByName(client, contextName, domainName);
  if (domain instanceof ERRORS.DomainNotFound) {
    output.error(`Domain not found under ${chalk.bold(contextName)}`);
    output.log(`Run ${cmd('now domains ls')} to see your domains.`);
    return 1;
  }
  if (domain instanceof ERRORS.DomainPermissionDenied) {
    output.error(
      `You don't have permissions over domain ${chalk.underline(
        domain.meta.domain
      )} under ${chalk.bold(domain.meta.context)}.`
    );
    return 1;
  }

  if (!opts['--yes']) {
    const aliases = await getDomainAliases(client, domainName);
    if (aliases.length > 0) {
      output.warn(
        `This domain's ${chalk.bold(
          plural('alias', aliases.length, true)
        )} will be removed. Run ${chalk.dim('`now alias ls`')} to list them.`
      );
      if (
        !(await promptBool(
          `Are you sure you want to move ${param(domainName)}?`
        ))
      ) {
        output.log('Aborted');
        return 0;
      }
    }
  }

  const context = contextName;
  const moveTokenResult = await withSpinner('Moving', () => {
    return moveOutDomain(client, context, domainName, destination);
  });
  if (moveTokenResult instanceof ERRORS.DomainMoveConflict) {
    output.error(
      `Please remove custom suffix for ${param(domainName)} before moving out`
    );
    return 1;
  }
  if (moveTokenResult instanceof ERRORS.DomainNotFound) {
    output.error(`Domain not found under ${chalk.bold(contextName)}`);
    output.log(`Run ${cmd('now domains ls')} to see your domains.`);
    return 1;
  }
  if (moveTokenResult instanceof ERRORS.DomainPermissionDenied) {
    output.error(
      `You don't have permissions over domain ${chalk.underline(
        moveTokenResult.meta.domain
      )} under ${chalk.bold(moveTokenResult.meta.context)}.`
    );
    return 1;
  }
  if (moveTokenResult instanceof ERRORS.InvalidMoveDestination) {
    output.error(
      `Destination ${chalk.bold(
        destination
      )} is invalid. Please supply a valid username, email, team slug, user id, or team id.`
    );
    return 1;
  }

  const { moved } = moveTokenResult;
  if (moved) {
    output.success(`${param(domainName)} was moved to ${param(destination)}.`);
  } else {
    output.success(
      `Sent ${param(destination)} an email to approve the ${param(
        domainName
      )} move request.`
    );
  }
  return 0;
}

async function getArgs(args: string[]) {
  let [domainName, destination] = args;

  if (!domainName) {
    domainName = await textInput({
      label: `- Domain name: `,
      validateValue: isRootDomain
    });
  }

  if (!destination) {
    destination = await textInput({
      label: `- Destination: `,
      validateValue: (v: string) => Boolean(v && v.length > 0)
    });
  }

  return { domainName, destination };
}
