import chalk from 'chalk';
import ms from 'ms';
import table from 'text-table';
import Now from '../util';
import getAliases from '../util/alias/get-aliases';
import getArgs from '../util/get-args';
import getDeploymentInstances from '../util/deploy/get-deployment-instances';
import createOutput from '../util/output';
import { handleError } from '../util/error';
import cmd from '../util/output/cmd.ts';
import logo from '../util/output/logo';
import elapsed from '../util/output/elapsed.ts';
import wait from '../util/output/wait';
import strlen from '../util/strlen.ts';
import Client from '../util/client.ts';
import getScope from '../util/get-scope.ts';
import toHost from '../util/to-host';
import parseMeta from '../util/parse-meta';
import { isValidName } from '../util/is-valid-name';
import getCommandFlags from '../util/get-command-flags';
import { getPkgName } from '../util/pkg-name.ts';

const help = () => {
  console.log(`
  ${chalk.bold(`${logo} ${getPkgName()} list`)} [app]

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
    -S, --scope                    Set a custom scope
    -a, --all                      See all instances for each deployment (requires [app])
    -m, --meta                     Filter deployments by metadata (e.g.: ${chalk.dim(
      '`-m KEY=value`'
    )}). Can appear many times.
    -N, --next                     Show next page of results

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} List all deployments

    ${chalk.cyan(`$ ${getPkgName()} ls`)}

  ${chalk.gray('–')} List all deployments for the app ${chalk.dim('`my-app`')}

    ${chalk.cyan(`$ ${getPkgName()} ls my-app`)}

  ${chalk.gray(
    '–'
  )} List all deployments and all instances for the app ${chalk.dim('`my-app`')}

    ${chalk.cyan(`$ ${getPkgName()} ls my-app --all`)}

  ${chalk.gray('–')} Filter deployments by metadata

    ${chalk.cyan(`$ ${getPkgName()} ls -m key1=value1 -m key2=value2`)}

  ${chalk.gray('–')} Paginate deployments for a project, where ${chalk.dim(
    '`1584722256178`'
  )} is the time in milliseconds since the UNIX epoch.

    ${chalk.cyan(`$ ${getPkgName()} ls my-app --next 1584722256178`)}
`);
};

// Options
// $FlowFixMe
export default async function main(ctx) {
  let argv;

  try {
    argv = getArgs(ctx.argv.slice(2), {
      '--all': Boolean,
      '--meta': [String],
      '-a': '--all',
      '-m': '--meta',
      '--next': Number,
      '-N': '--next',
    });
  } catch (err) {
    handleError(err);
    return 1;
  }

  const debugEnabled = argv['--debug'];

  const { print, log, error, note, debug } = createOutput({
    debug: debugEnabled,
  });

  if (argv._.length > 2) {
    error(`${cmd(`${getPkgName()} ls [app]`)} accepts at most one argument`);
    return 1;
  }

  let app = argv._[1];
  let host = null;

  const apiUrl = ctx.apiUrl;

  if (argv['--help']) {
    help();
    return 0;
  }

  const meta = parseMeta(argv['--meta']);
  const {
    authConfig: { token },
    config,
  } = ctx;
  const { currentTeam, includeScheme } = config;
  const client = new Client({
    apiUrl,
    token,
    currentTeam,
    debug: debugEnabled,
  });
  let contextName = null;

  try {
    ({ contextName } = await getScope(client));
  } catch (err) {
    if (err.code === 'NOT_AUTHORIZED' || err.code === 'TEAM_DELETED') {
      error(err.message);
      return 1;
    }

    throw err;
  }

  const nextTimestamp = argv['--next'];

  if (typeof nextTimestamp !== undefined && Number.isNaN(nextTimestamp)) {
    error('Please provide a number for flag `--next`');
    return 1;
  }

  const stopSpinner = wait(
    `Fetching deployments in ${chalk.bold(contextName)}`
  );

  const now = new Now({ apiUrl, token, debug: debugEnabled, currentTeam });
  const start = new Date();

  if (argv['--all'] && !app) {
    error('You must define an app when using `-a` / `--all`');
    return 1;
  }

  if (app && !isValidName(app)) {
    error(`The provided argument "${app}" is not a valid project name`);
    return 1;
  }

  // Some people are using entire domains as app names, so
  // we need to account for this here
  if (app && toHost(app).endsWith('.now.sh')) {
    note(
      `We suggest using \`${getPkgName()} inspect <deployment>\` for retrieving details about a single deployment`
    );

    const asHost = toHost(app);
    const hostParts = asHost.split('-');

    if (hostParts < 2) {
      stopSpinner();
      error('Only deployment hostnames are allowed, no aliases');
      return 1;
    }

    app = null;
    host = asHost;
  }

  let response;

  try {
    debug('Fetching deployments');
    response = await now.list(app, {
      version: 6,
      meta,
      nextTimestamp,
    });
  } catch (err) {
    stopSpinner();
    throw err;
  }

  let { deployments, pagination } = response;

  if (app && !deployments.length) {
    debug(
      'No deployments: attempting to find deployment that matches supplied app name'
    );
    let match;

    try {
      await now.findDeployment(app);
    } catch (err) {
      if (err.status === 404) {
        debug('Ignore findDeployment 404');
      } else {
        stopSpinner();
        throw err;
      }
    }

    if (match !== null && typeof match !== 'undefined') {
      debug('Found deployment that matches app name');
      deployments = Array.of(match);
    }
  }

  if (app && !deployments.length) {
    debug(
      'No deployments: attempting to find aliases that matches supplied app name'
    );
    const { aliases } = await getAliases(now);
    const item = aliases.find(e => e.uid === app || e.alias === app);

    if (item) {
      debug(`Found alias that matches app name: ${item.alias}`);

      if (Array.isArray(item.rules)) {
        now.close();
        stopSpinner();
        log(`Found matching path alias: ${chalk.cyan(item.alias)}`);
        log(
          `Please run ${cmd(`${getPkgName()} alias ls ${item.alias}`)} instead`
        );
        return 0;
      }

      const match = await now.findDeployment(item.deploymentId);
      const instances = await getDeploymentInstances(
        now,
        item.deploymentId,
        'now_cli_alias_instances'
      );
      match.instanceCount = Object.keys(instances).reduce(
        (count, dc) => count + instances[dc].instances.length,
        0
      );
      if (match !== null && typeof match !== 'undefined') {
        deployments = Array.of(match);
      }
    }
  }

  now.close();

  if (argv['--all']) {
    await Promise.all(
      deployments.map(async ({ uid, instanceCount }, i) => {
        deployments[i].instances =
          instanceCount > 0 ? await now.listInstances(uid) : [];
      })
    );
  }

  if (host) {
    deployments = deployments.filter(deployment => deployment.url === host);
  }

  stopSpinner();
  log(
    `Deployments under ${chalk.bold(contextName)} ${elapsed(
      Date.now() - start
    )}`
  );

  // we don't output the table headers if we have no deployments
  if (!deployments.length) {
    return 0;
  }

  // information to help the user find other deployments or instances
  if (app == null) {
    log(
      `To list more deployments for a project run ${cmd(
        `${getPkgName()} ls [project]`
      )}`
    );
  } else if (!argv['--all']) {
    log(
      `To list deployment instances run ${cmd(
        `${getPkgName()} ls --all [project]`
      )}`
    );
  }

  print('\n');

  console.log(
    `${table(
      [
        ['project', 'latest deployment', 'state', 'age', 'username'].map(s =>
          chalk.dim(s)
        ),
        ...deployments
          .sort(sortRecent())
          .map(dep => [
            [
              getProjectName(dep),
              chalk.bold((includeScheme ? 'https://' : '') + dep.url),
              stateString(dep.state),
              chalk.gray(ms(Date.now() - new Date(dep.createdAt))),
              dep.creator.username,
            ],
            ...(argv['--all']
              ? dep.instances.map(i => [
                  '',
                  ` ${chalk.gray('-')} ${i.url} `,
                  '',
                  '',
                  '',
                ])
              : []),
          ])
          // flatten since the previous step returns a nested
          // array of the deployment and (optionally) its instances
          .reduce((ac, c) => ac.concat(c), [])
          .filter(
            app == null
              ? // if an app wasn't supplied to filter by,
                // we only want to render one deployment per app
                filterUniqueApps()
              : () => true
          ),
      ],
      {
        align: ['l', 'l', 'r', 'l', 'b'],
        hsep: ' '.repeat(4),
        stringLength: strlen,
      }
    ).replace(/^/gm, '  ')}\n`
  );

  if (pagination && pagination.count === 20) {
    const flags = getCommandFlags(argv, ['_', '--next']);
    log(
      `To display the next page run ${cmd(
        `${getPkgName()} ls${app ? ' ' + app : ''}${flags} --next ${
          pagination.next
        }`
      )}`
    );
  }
}

function getProjectName(d) {
  // We group both file and files into a single project
  if (d.name === 'file') {
    return 'files';
  }

  return d.name;
}

// renders the state string
function stateString(s) {
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

// sorts by most recent deployment
function sortRecent() {
  return function recencySort(a, b) {
    return b.createdAt - a.createdAt;
  };
}

// filters only one deployment per app, so that
// the user doesn't see so many deployments at once.
// this mode can be bypassed by supplying an app name
function filterUniqueApps() {
  const uniqueApps = new Set();
  return function uniqueAppFilter([appName]) {
    if (uniqueApps.has(appName)) {
      return false;
    }
    uniqueApps.add(appName);
    return true;
  };
}
