import chalk from 'chalk';
import plural from 'pluralize';

import { DomainNotFound, DomainPermissionDenied } from '../../util/errors-ts';
import { NowContext, Domain, Alias, Cert } from '../../types';
import { Output } from '../../util/output';
import Client from '../../util/client';
import cmd from '../../util/output/cmd';
import deleteCertById from '../../util/certs/delete-cert-by-id';
import getDomainByName from '../../util/domains/get-domain-by-name';
import getScope from '../../util/get-scope';
import removeAliasById from '../../util/alias/remove-alias-by-id';
import removeDomainByName from '../../util/domains/remove-domain-by-name';
import stamp from '../../util/output/stamp';
import * as ERRORS from '../../util/errors-ts';
import param from '../../util/output/param';
import promptBool from '../../util/input/prompt-bool';
import setCustomSuffix from '../../util/domains/set-custom-suffix';

type Options = {
  '--debug': boolean;
  '--yes': boolean;
};

export default async function rm(
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
  const [domainName] = args;
  let contextName = null;

  try {
    ({ contextName } = await getScope(client));
  } catch (err) {
    if (err.code === 'NOT_AUTHORIZED' || err.code === 'TEAM_DELETED') {
      output.error(err.message);
      return 1;
    }

    throw err;
  }

  if (!domainName) {
    output.error(`${cmd('now domains rm <domain>')} expects one argument`);
    return 1;
  }

  if (args.length !== 1) {
    output.error(
      `Invalid number of arguments. Usage: ${chalk.cyan(
        '`now domains rm <domain>`'
      )}`
    );
    return 1;
  }

  const domain = await getDomainByName(client, contextName, domainName);
  if (domain instanceof DomainNotFound) {
    output.error(
      `Domain not found by "${domainName}" under ${chalk.bold(contextName)}`
    );
    output.log(`Run ${cmd('now domains ls')} to see your domains.`);
    return 1;
  }

  if (domain instanceof DomainPermissionDenied) {
    output.error(
      `You don't have access to the domain ${domainName} under ${chalk.bold(
        contextName
      )}`
    );
    output.log(`Run ${cmd('now domains ls')} to see your domains.`);
    return 1;
  }

  const skipConfirmation = opts['--yes'];
  if (
    !skipConfirmation &&
    !(await promptBool(`Are you sure you want to remove ${param(domainName)}?`))
  ) {
    output.log('Aborted');
    return 0;
  }

  return removeDomain(output, client, contextName, skipConfirmation, domain);
}

async function removeDomain(
  output: Output,
  client: Client,
  contextName: string,
  skipConfirmation: boolean,
  domain: Domain,
  aliasIds: string[] = [],
  certIds: string[] = [],
  suffix: boolean = false
): Promise<number> {
  const removeStamp = stamp();
  output.debug(`Removing domain`);

  for (const id of aliasIds) {
    output.debug(`Removing alias ${id}`);
    await removeAliasById(client, id);
  }

  for (const id of certIds) {
    output.debug(`Removing cert ${id}`);
    await deleteCertById(output, client, id);
  }

  if (suffix) {
    output.debug(`Removing custom suffix`);
    await setCustomSuffix(client, contextName, domain.name, null);
  }

  const removeResult = await removeDomainByName(
    client,
    contextName,
    domain.name
  );

  if (removeResult instanceof ERRORS.DomainNotFound) {
    output.error(`Domain not found under ${chalk.bold(contextName)}`);
    output.log(`Run ${cmd('now domains ls')} to see your domains.`);
    return 1;
  }

  if (removeResult instanceof ERRORS.DomainPermissionDenied) {
    output.error(
      `You don't have permissions over domain ${chalk.underline(
        removeResult.meta.domain
      )} under ${chalk.bold(removeResult.meta.context)}.`
    );
    return 1;
  }

  if (removeResult instanceof ERRORS.DomainRemovalConflict) {
    const { aliases, certs, suffix, transferring } = removeResult.meta;
    if (transferring) {
      output.error(
        `${param(
          domain.name
        )} transfer should be declined or approved before removing.`
      );
      return 1;
    }

    output.log(
      `We found conflicts when attempting to remove ${param(domain.name)}.`
    );

    if (aliases.length > 0) {
      output.warn(
        `This domain's ${chalk.bold(
          plural('alias', aliases.length, true)
        )} will be removed. Run ${chalk.dim('`now alias ls`')} to list them.`
      );
    }

    if (certs.length > 0) {
      output.warn(
        `This domain's ${chalk.bold(
          plural('certificate', certs.length, true)
        )} will be removed. Run ${chalk.dim('`now cert ls`')} to list them.`
      );
    }

    if (suffix) {
      output.warn(
        `The ${chalk.bold(`custom suffix`)} associated with this domain.`
      );
    }

    if (
      !skipConfirmation &&
      !(await promptBool(`Remove conflicts associated with domain?`))
    ) {
      output.log('Aborted');
      return 0;
    }

    return removeDomain(
      output,
      client,
      contextName,
      skipConfirmation,
      domain,
      aliases,
      certs,
      suffix
    );
  }

  console.log(
    `${chalk.cyan('> Success!')} Domain ${chalk.bold(
      domain.name
    )} removed ${removeStamp()}`
  );
  return 0;
}
