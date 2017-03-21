// Native
const { join } = require('path');

// Packages
const fs = require('fs-promise');
const chalk = require('chalk');

// Ours
const { error } = require('./error');
const readMetaData = require('./read-metadata');
const NowAlias = require('./alias');

exports.assignAlias = async (autoAlias, token, deployment, apiUrl, debug) => {
  const aliases = new NowAlias(apiUrl, token, { debug });
  console.log(
    `> Assigning alias ${chalk.bold.underline(autoAlias)} to deployment...`
  );

  // Assign alias
  await aliases.set(String(deployment), String(autoAlias));
};

exports.reAlias = async (token, host, help, exit, apiUrl, debug, alias) => {
  const path = process.cwd();

  const configFiles = {
    pkg: join(path, 'package.json'),
    nowJSON: join(path, 'now.json')
  };

  if (!fs.existsSync(configFiles.pkg) && !fs.existsSync(configFiles.nowJSON)) {
    error(
      `Couldn't find a now.json or package.json file with an alias list in it`
    );
    return;
  }

  const { nowConfig, name } = await readMetaData(path, {
    deploymentType: 'npm', // Hard coding settings…
    quiet: true // `quiet`
  });

  if (!host) {
    const lastAlias = await alias.last(name);
    host = lastAlias.url;
  }

  if (!nowConfig) {
    help();
    return exit(0);
  }

  let pointers = [];

  if (nowConfig.alias) {
    const value = nowConfig.alias;

    if (typeof value === 'string') {
      pointers.push(value);
    } else if (Array.isArray(value)) {
      pointers = pointers.concat(nowConfig.alias);
    } else {
      error(`Property ${chalk.grey('aliases')} is not a valid array or string`);
      return exit(1);
    }
  }

  if (nowConfig.aliases && Array.isArray(nowConfig.aliases)) {
    console.log(
      `${chalk.red('Deprecated!')} The property ${chalk.grey('aliases')} will be ` +
        `removed from the config file soon.`
    );
    console.log('Read more about the new way here: http://bit.ly/2l2v5Fg\n');

    pointers = pointers.concat(nowConfig.aliases);
  }

  if (pointers.length === 0) {
    help();
    return exit(0);
  }

  const assignments = [];

  for (const pointer of pointers) {
    assignments.push(exports.assignAlias(pointer, token, host, apiUrl, debug));
  }

  await Promise.all(assignments);
};
