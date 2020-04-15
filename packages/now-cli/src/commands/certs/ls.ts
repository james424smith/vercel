import chalk from 'chalk';
import ms from 'ms';
import table from 'text-table';
// @ts-ignore
import Now from '../../util';
import cmd from '../../util/output/cmd';
import Client from '../../util/client';
import getScope from '../../util/get-scope';
import stamp from '../../util/output/stamp';
import getCerts from '../../util/certs/get-certs';
import strlen from '../../util/strlen';
import { Output } from '../../util/output';
import { NowContext, Cert } from '../../types';
import getCommandFlags from '../../util/get-command-flags';

interface Options {
  '--debug'?: boolean;
  '--next'?: number;
}

async function ls(
  ctx: NowContext,
  opts: Options,
  args: string[],
  output: Output
): Promise<number> {
  const {
    authConfig: { token },
    config,
  } = ctx;
  const { currentTeam } = config;
  const { apiUrl } = ctx;
  const { '--debug': debug, '--next': nextTimestamp } = opts;
  const client = new Client({ apiUrl, token, currentTeam, debug });
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
  if (typeof nextTimestamp !== 'undefined' && Number.isNaN(nextTimestamp)) {
    output.error('Please provide a number for flag --next');
    return 1;
  }
  const now = new Now({ apiUrl, token, debug, currentTeam });
  const lsStamp = stamp();

  if (args.length !== 0) {
    output.error(
      `Invalid number of arguments. Usage: ${chalk.cyan('`now certs ls`')}`
    );
    return 1;
  }

  // Get the list of certificates
  const { certs, pagination } = await getCerts(now, nextTimestamp).catch(
    err => err
  );

  output.log(
    `${
      certs.length > 0 ? 'Certificates' : 'No certificates'
    } found under ${chalk.bold(contextName)} ${lsStamp()}`
  );

  if (certs.length > 0) {
    console.log(formatCertsTable(certs));
  }

  if (pagination && pagination.count === 20) {
    const flags = getCommandFlags(opts, ['_', '--next']);
    output.log(
      `To display the next page run ${cmd(
        `now certs ls${flags} --next ${pagination.next}`
      )}`
    );
  }

  return 0;
}

function formatCertsTable(certsList: Cert[]) {
  return `${table(
    [formatCertsTableHead(), ...formatCertsTableBody(certsList)],
    {
      align: ['l', 'l', 'r', 'c', 'r'],
      hsep: ' '.repeat(2),
      stringLength: strlen,
    }
  ).replace(/^(.*)/gm, '  $1')}\n`;
}

function formatCertsTableHead(): string[] {
  return [
    chalk.dim('id'),
    chalk.dim('cns'),
    chalk.dim('expiration'),
    chalk.dim('renew'),
    chalk.dim('age'),
  ];
}

function formatCertsTableBody(certsList: Cert[]) {
  const now = new Date();
  return certsList.reduce<string[][]>(
    (result, cert) => result.concat(formatCert(now, cert)),
    []
  );
}

function formatCert(time: Date, cert: Cert) {
  return cert.cns.map((cn, idx) =>
    idx === 0
      ? formatCertFirstCn(time, cert, cn, cert.cns.length > 1)
      : formatCertNonFirstCn(cn, cert.cns.length > 1)
  );
}

function formatCertNonFirstCn(cn: string, multiple: boolean): string[] {
  return ['', formatCertCn(cn, multiple), '', '', ''];
}

function formatCertCn(cn: string, multiple: boolean) {
  return multiple ? `${chalk.gray('-')} ${chalk.bold(cn)}` : chalk.bold(cn);
}

function formatCertFirstCn(
  time: Date,
  cert: Cert,
  cn: string,
  multiple: boolean
): string[] {
  return [
    cert.uid,
    formatCertCn(cn, multiple),
    formatExpirationDate(new Date(cert.expiration)),
    cert.autoRenew ? 'yes' : 'no',
    chalk.gray(ms(time.getTime() - new Date(cert.created).getTime())),
  ];
}

function formatExpirationDate(date: Date) {
  const diff = date.getTime() - Date.now();
  return diff < 0
    ? chalk.gray(`${ms(-diff)} ago`)
    : chalk.gray(`in ${ms(diff)}`);
}

export default ls;
