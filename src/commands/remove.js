import mri from 'mri';
import chalk from 'chalk';
import ms from 'ms';
import plural from 'pluralize';
import table from 'text-table';
import Now from '../util';
import getAliases from '../util/alias/get-aliases';
import createOutput from '../util/output';
import wait from '../util/output/wait';
import logo from '../util/output/logo';
import cmd from '../util/output/cmd.ts';
import elapsed from '../util/output/elapsed.ts';
import { normalizeURL } from '../util/url';
import Client from '../util/client.ts';
import getScope from '../util/get-scope.ts';
import { NowError } from '../util/now-error';
import removeProject from '../util/projects/remove-project';
import getProjectByIdOrName from '../util/projects/get-project-by-id-or-name';
import getDeploymentByIdOrHost from '../util/deploy/get-deployment-by-id-or-host';
import getDeploymentsByProjectId from '../util/deploy/get-deployments-by-project-id';

const help = () => {
  console.log(`
  ${chalk.bold(`${logo} now remove`)} [...deploymentId|deploymentName]

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
    -y, --yes                      Skip confirmation
    -s, --safe                     Skip deployments with an active alias
    -S, --scope                    Set a custom scope

  ${chalk.dim('Examples:')}

  ${chalk.gray('–')} Remove a deployment identified by ${chalk.dim(
    '`deploymentId`'
  )}

    ${chalk.cyan('$ now rm deploymentId')}

  ${chalk.gray('–')} Remove all deployments with name ${chalk.dim('`my-app`')}

    ${chalk.cyan('$ now rm my-app')}

  ${chalk.gray('–')} Remove two deployments with IDs ${chalk.dim(
    '`eyWt6zuSdeus`'
  )} and ${chalk.dim('`uWHoA9RQ1d1o`')}

    ${chalk.cyan('$ now rm eyWt6zuSdeus uWHoA9RQ1d1o')}
`);
};

// Options

export default async function main(ctx) {
  let argv;

  argv = mri(ctx.argv.slice(2), {
    boolean: ['help', 'debug', 'hard', 'yes', 'safe'],
    alias: {
      help: 'h',
      debug: 'd',
      yes: 'y',
      safe: 's'
    }
  });

  argv._ = argv._.slice(1);

  const apiUrl = ctx.apiUrl;
  const hard = argv.hard || false;
  const skipConfirmation = argv.yes || false;
  const ids = argv._;
  const debugEnabled = argv.debug;
  const output = createOutput({ debug: debugEnabled });
  const { success, error, log } = output;

  if (ids.length < 1) {
    error(`${cmd('now rm')} expects at least one argument`);
    help();
    return 1;
  }

  if (argv.help || ids[0] === 'help') {
    help();
    return 2;
  }

  const { authConfig: { token }, config } = ctx;
  const { currentTeam } = config;
  const client = new Client({
    apiUrl,
    token,
    currentTeam,
    debug: debugEnabled
  });
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

  const now = new Now({ apiUrl, token, debug: debugEnabled, currentTeam });

  const cancelWait = wait(
    `Fetching deployment(s) ${ids
      .map(id => `"${id}"`)
      .join(' ')} in ${chalk.bold(contextName)}`
  );

  let aliases;
  let projects;
  let deployments;
  const findStart = Date.now();

  try {
    const searchFilter = (d) => ids.some((id) => (
      (d && !(d instanceof NowError)) && (
      d.uid === id ||
      d.name === id ||
      d.url === normalizeURL(id)
    )));

    const [deploymentList, projectList] = await Promise.all([
      Promise.all(ids.map((idOrHost) => getDeploymentByIdOrHost(now, contextName, idOrHost))),
      Promise.all(ids.map(async (idOrName) => getProjectByIdOrName(now, idOrName)))
    ]);

    deployments = deploymentList.filter(searchFilter);
    projects = projectList.filter(searchFilter);

    // When `--safe` is set we want to replace all projects
    // with with deployments to verify the aliases
    if (argv.safe) {
      const projectDeployments = await Promise.all(projects.map((project) => {
        return getDeploymentsByProjectId(client, project.id, { max: 201, continue: true });
      }));

      projectDeployments
        .slice(0, 201)
        .map((pDeployments) => deployments.push(...pDeployments));

      projects = [];
    } else {
      // Remove all deployments that are included in the projects
      deployments = deployments.filter((d) => !projects.some((p) => p.name === d.name));
    }

    aliases = await Promise.all(deployments.map(depl => getAliases(now, depl.uid)));
    cancelWait();
  } catch (err) {
    cancelWait();
    throw err;
  }

  deployments = deployments.filter((match, i) => {
    if (argv.safe && aliases[i].length > 0) {
      return false;
    }

    match.aliases = aliases[i];
    return true;
  });

  if (deployments.length === 0 && projects.length === 0) {
    log(
      `Could not find ${argv.safe ? 'unaliased' : 'any'} deployments ` +
      `or projects matching ` +
      `${ids.map(id => chalk.bold(`"${id}"`)).join(', ')}. Run ${cmd('now ls')} to list.`
    );
    return 0;
  }

  log(
    `Found ${deploymentsAndProjects(deployments, projects)} for removal in ` +
    `${chalk.bold(contextName)} ${elapsed(Date.now() - findStart)}`
  );

  if (deployments.length > 200) {
    output.warn(
      `Only 200 deployments can get deleted at once. ` +
      `Please continue 10 minutes after deletion to remove the rest.`
    );
  }

  if (!skipConfirmation) {
    const confirmation = (await readConfirmation(
      deployments,
      projects,
      output
    )).toLowerCase();

    if (confirmation !== 'y' && confirmation !== 'yes') {
      output.log('Aborted');
      now.close();

      // Hangs otherwise
      process.exit(1);
      return 1;
    }
  }

  const start = new Date();

  await Promise.all([
    ...deployments.map(depl => now.remove(depl.uid, { hard })),
    ...projects.map(project => removeProject(now, project.id))
  ]);

  success(
    `Removed ${deploymentsAndProjects(deployments, projects)} ` +
    `${elapsed(Date.now() - start)}`
  );

  deployments.forEach(depl => {
    console.log(`${chalk.gray('-')} ${chalk.bold(depl.url)}`);
  });

  projects.forEach(project => {
    console.log(`${chalk.gray('-')} ${chalk.bold(project.name)}`);
  });

  // if we close normally, we get a really odd error:
  //  Error: unexpected end of file
  //  at Zlib.zlibOnError [as onerror] (zlib.js:142:17) Error: unexpected end of file
  //  at Zlib.zlibOnError [as onerror] (zlib.js:142:17)
  // which seems fixable only by exiting directly here, and only
  // impacts this command, consistently
  // now.close()
  process.exit(0);
  return 0;
}

function readConfirmation(deployments, projects, output) {
  return new Promise(resolve => {
    if (deployments.length > 0) {
      output.log(
        `The following ${plural('deployment', deployments.length, deployments.length > 1)} ` +
        `will be permanently removed:`
      );

      const deploymentTable = table(
        deployments.map(depl => {
          const time = chalk.gray(`${ms(new Date() - depl.created)} ago`);
          const url = depl.url ? chalk.underline(`https://${depl.url}`) : '';
          return [`  ${depl.uid}`, url, time];
        }),
        { align: ['l', 'r', 'l'], hsep: ' '.repeat(6) }
      );
      output.print(`${deploymentTable}\n`);
    }

    for (const depl of deployments) {
      for (const {alias} of depl.aliases) {
        output.warn(
          `${chalk.underline(`https://${alias}`)} is an alias for ` +
          `${chalk.bold(depl.url)} and will be removed`
        );
      }
    }

    if (projects.length > 0) {
      console.log(
        `The following ${plural('project', projects.length, projects.length > 1)} will be permanently removed, ` +
        `including all ${projects.length > 1 ? 'their' : 'its'} deployments and aliases:`
      );

      for (const project of projects) {
        console.log(`${chalk.gray('-')} ${chalk.bold(project.name)}`);
      }
    }

    output.print(
      `${chalk.bold.red('> Are you sure?')} ${chalk.gray('[y/N] ')}`
    );

    process.stdin
      .on('data', d => {
        process.stdin.pause();
        resolve(d.toString().trim());
      })
      .resume();
  });
}

function deploymentsAndProjects(deployments = [], projects = [], conjunction = 'and') {
  if (!projects || projects.length === 0) {
    return `${plural('deployment', deployments.length, true)}`
  }

  if (!deployments || deployments.length === 0) {
    return `${plural('project', projects.length, true)}`;
  }

  return (
    `${plural('deployment', deployments.length, true)} ` +
    `${conjunction} ${plural('project', projects.length, true)}`
  );
}
