// @flow

// Packages
const chalk = require('chalk');
const table = require('text-table');

// Utilities
const cmd = require('../util/output/cmd');
const createOutput = require('../util/output');
const Now = require('../util/');
const logo = require('../util/output/logo');
const elapsed = require('../util/output/elapsed');
const wait = require('../util/output/wait');
const { handleError } = require('../util/error');
const strlen = require('../util/strlen');
const getScope = require('../util/get-scope');

import getArgs from '../util/get-args';
import buildsList from '../util/output/builds';

const STATIC = 'STATIC';

const help = () => {
  console.log(`
  ${chalk.bold(`${logo} now inspect`)} <url>

  ${chalk.dim('Options:')}

    -h, --help                     Output usage information
    -A ${chalk.bold.underline('FILE')}, --local-config=${chalk.bold.underline(
    'FILE'
  )}   Path to the local ${'`now.json`'} file
    -Q ${chalk.bold.underline('DIR')}, --global-config=${chalk.bold.underline(
    'DIR'
  )}    Path to the global ${'`.now`'} directory
    -t ${chalk.bold.underline('TOKEN')}, --token=${chalk.bold.underline(
    'TOKEN'
  )}        Login token
    -d, --debug                    Debug mode [off]
    -T, --team                     Set a custom team scope

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Get information about a deployment by its unique URL

    ${chalk.cyan('$ now inspect my-deployment-ji2fjij2.now.sh')}

  ${chalk.gray('-')} Get information about the deployment an alias points to

    ${chalk.cyan('$ now scale my-deployment.now.sh')}
  `);
};

module.exports = async function main(ctx: any): Promise<number> {
  let id;
  let deployment;
  let argv;

  try {
    argv = getArgs(ctx.argv.slice(2));
  } catch (err) {
    handleError(err);
    return 1;
  }

  if (argv['--help']) {
    help();
    return 2;
  }

  const apiUrl = ctx.apiUrl;
  const debugEnabled = argv['--debug'];
  const output = createOutput({ debug: debugEnabled });
  const { print, log, error } = output;

  // extract the first parameter
  id = argv._[1];

  if (argv._.length !== 2) {
    error(`${cmd('now inspect <url>')} expects exactly one argument`);
    help();
    return 1;
  }

  const { authConfig: { token }, config } = ctx;
  const { currentTeam } = config;
  const { contextName } = await getScope({
    apiUrl,
    token,
    debug: debugEnabled,
    currentTeam
  });

  const now = new Now({ apiUrl, token, debug: debugEnabled, currentTeam });

  // resolve the deployment, since we might have been given an alias
  const depFetchStart = Date.now();
  const cancelWait = wait(
    `Fetching deployment "${id}" in ${chalk.bold(contextName)}`
  );

  try {
    deployment = await now.findDeployment(id);
  } catch (err) {
    cancelWait();
    if (err.status === 404) {
      error(`Failed to find deployment "${id}" in ${chalk.bold(contextName)}`);
      return 1;
    } else if (err.status === 403) {
      error(
        `No permission to access deployment "${id}" in ${chalk.bold(
          contextName
        )}`
      );
      return 1;
    } else {
      // unexpected
      throw err;
    }
  }

  const {
    id: finalId,
    name,
    state,
    type,
    slot,
    sessionAffinity,
    url,
    created,
    limits,
    version
  } = deployment;

  const isBuilds = version === 2;
  const buildsUrl = `/v1/now/deployments/${finalId}/builds`;

  const [scale, events, {builds}] = await Promise.all([
    caught(
      now.fetch(`/v3/now/deployments/${encodeURIComponent(finalId)}/instances`)
    ),
    type === STATIC
      ? null
      : caught(
          now.fetch(
            `/v1/now/deployments/${encodeURIComponent(finalId)}/events?types=event`
          )
      ),
    isBuilds ? now.fetch(buildsUrl): { builds: [] }
  ]);

  cancelWait();
  log(
    `Fetched deployment "${url}" in ${chalk.bold(contextName)} ${elapsed(
      Date.now() - depFetchStart
    )}`
  );

  print('\n');
  print(chalk.bold('  Meta\n'));
  print(`    ${chalk.dim('version')}\t${version}\n`);
  print(`    ${chalk.dim('id')}\t\t${finalId}\n`);
  print(`    ${chalk.dim('name')}\t${name}\n`);
  print(`    ${chalk.dim('readyState')}\t${stateString(state)}\n`);
  if (!isBuilds) {
    print(`    ${chalk.dim('type')}\t${type}\n`);
  }
  if (slot) {
    print(`    ${chalk.dim('slot')}\t${slot}\n`);
  }
  if (sessionAffinity) {
    print(`    ${chalk.dim('affinity')}\t${sessionAffinity}\n`);
  }
  print(`    ${chalk.dim('url')}\t\t${url}\n`);
  print(
    `    ${chalk.dim('createdAt')}\t${new Date(created)} ${elapsed(
      Date.now() - created, true)}\n`
  );
  print('\n');

  if (builds.length > 0) {
    const times = {};

    for (const build of builds) {
      const {id, createdAt, readyStateAt} = build;
      times[id] = createdAt ? elapsed(readyStateAt - createdAt) : null;
    }

    print(chalk.bold('  Builds\n'));
    print(buildsList(builds, times, true).toPrint);
    print('\n');
  }

  if (limits) {
    print(chalk.bold('  Limits\n'));
    print(
      `    ${chalk.dim('duration')}\t\t${limits.duration} ${elapsed(
        limits.duration
      )}\n`
    );
    print(
      `    ${chalk.dim('maxConcurrentReqs')}\t${limits.maxConcurrentReqs}\n`
    );
    print(
      `    ${chalk.dim('timeout')}\t\t${limits.timeout} ${elapsed(
        limits.timeout
      )}\n`
    );
    print('\n');
  }

  if (type === STATIC || isBuilds) {
    return 0;
  }

  print(chalk.bold('  Scale\n'));

  let exitCode = 0;

  if (scale instanceof Error) {
    error(`Scale information unavailable: ${scale}`);
    exitCode = 1;
  } else {
    const dcs = Object.keys(scale);
    const t = [['dc', 'min', 'max', 'current'].map(v => chalk.gray(v))];
    for (const dc of dcs) {
      const { instances } = scale[dc];
      const cfg = deployment.scale[dc] || {};
      t.push([dc, cfg.min || 0, cfg.max || 0, instances.length]);
    }
    print(
      table(t, {
        align: ['l', 'c', 'c', 'c'],
        hsep: ' '.repeat(8),
        stringLength: strlen
      }).replace(/^(.*)/gm, '    $1') + '\n'
    );
    print('\n');
  }

  print(chalk.bold('  Events\n'));
  if (events instanceof Error) {
    error(`Events unavailable: ${scale}`);
    exitCode = 1;
  } else if (events) {
    events.forEach(data => {
      if (!data.event) return; // keepalive
      print(
        `    ${chalk.gray(
          new Date(data.created).toISOString()
        )} ${data.event} ${getEventMetadata(data)}\n`
      );
    });
    print('\n');
  }

  return exitCode;
};

// gets the metadata that should be printed next to
// each event

type Event = {
  event: string,
  payload: any,
  created: number
};

function getEventMetadata({ event, payload }: Event): string {
  if (event === 'state') {
    return chalk.bold(payload.value);
  }

  if (event === 'instance-start' || event === 'instance-stop') {
    if (payload.dc != null) {
      return chalk.green(`(${payload.dc})`);
    }
  }

  return '';
}

// makes sure the promise never rejects, exposing the error
// as the resolved value instead
function caught(p): Promise<any> {
  return new Promise(r => {
    p.then(r).catch(r);
  });
}

// renders the state string
function stateString(s: string): string {
  switch (s) {
    case 'INITIALIZING':
      return chalk.yellow(s);

    case 'ERROR':
      return chalk.red(s);

    case 'READY':
      return s;

    default:
      return chalk.gray('UNKNOWN');
  }
}
