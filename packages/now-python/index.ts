import { join, dirname } from 'path';
import execa from 'execa';
import fs from 'fs';
import { promisify } from 'util';
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
import {
  getWriteableDirectory,
  download,
  glob,
  createLambda,
  BuildOptions,
} from '@now/build-utils';
import { downloadAndInstallPip } from './download-and-install-pip';

async function pipInstall(pipPath: string, workDir: string, ...args: string[]) {
  const target = '.';
  console.log(`running "pip install --target ${target} --upgrade ${args.join(' ')}"...`);
  try {
    await execa(pipPath, ['install', '--target', target, '--upgrade', ...args], {
      cwd: workDir,
      stdio: 'inherit',
    });
  } catch (err) {
    console.log(`failed to run "pip install --target ${target} --upgrade ${args.join(' ')}"...`);
    throw err;
  }
}

async function pipInstallUser(pipPath: string, ...args: string[]) {
  console.log(`running "pip install --user ${args.join(' ')}"...`);
  try {
    await execa(pipPath, ['install', '--user', ...args], {
      stdio: 'inherit',
    });
  } catch (err) {
    console.log(`failed to run "pip install --user ${args.join(' ')}"`);
    throw err;
  }
}

async function pipenvInstall(pyUserBase: string, srcDir: string) {
  console.log('running "pipenv_to_requirements -f');
  try {
    await execa(
      join(pyUserBase, 'bin', 'pipenv_to_requirements'),
      ['-f'],
      { cwd: srcDir, stdio: 'inherit' },
    );
  } catch (err) {
    console.log('failed to run "pipenv_to_requirements -f"');
    throw err;
  }
}

export const config = {
  maxLambdaSize: '5mb',
};

export const build = async ({ workPath, files, entrypoint }: BuildOptions) => {
  console.log('downloading files...');

  // eslint-disable-next-line no-param-reassign
  files = await download(files, workPath);

  // this is where `pip` will be installed to
  // we need it to be under `/tmp`
  const pyUserBase = await getWriteableDirectory();
  process.env.PYTHONUSERBASE = pyUserBase;
  const pipPath = await downloadAndInstallPip();

  try {
    // See: https://stackoverflow.com/a/44728772/376773
    //
    // The `setup.cfg` is required for `now dev` on MacOS, where without
    // this file being present in the src dir then this error happens:
    //
    // distutils.errors.DistutilsOptionError: must supply either home
    // or prefix/exec-prefix -- not both
    const setupCfg = join(workPath, 'setup.cfg');
    await writeFile(setupCfg, '[install]\nprefix=\n');
  } catch (err) {
    console.log('failed to create "setup.cfg" file');
    throw err;
  }

  await pipInstall(pipPath, workPath, 'werkzeug');
  await pipInstall(pipPath, workPath, 'requests');

  const entryDirectory = dirname(entrypoint);
  const requirementsTxt = join(entryDirectory, 'requirements.txt');

  if (files['Pipfile.lock']) {
    console.log('found "Pipfile.lock"');

    // Install pipenv.
    await pipInstallUser(pipPath, ' pipenv_to_requirements');

    await pipenvInstall(pyUserBase, workPath);
  }

  const fsFiles = await glob('**', workPath);

  if (fsFiles[requirementsTxt]) {
    console.log('found local "requirements.txt"');
    const requirementsTxtPath = fsFiles[requirementsTxt].fsPath;
    await pipInstall(pipPath, workPath, '-r', requirementsTxtPath);
  } else if (fsFiles['requirements.txt']) {
    console.log('found global "requirements.txt"');
    const requirementsTxtPath = fsFiles['requirements.txt'].fsPath;
    await pipInstall(pipPath, workPath, '-r', requirementsTxtPath);
  }

  const originalPyPath = join(__dirname, 'now_init.py');
  const originalNowHandlerPyContents = await readFile(originalPyPath, 'utf8');

  // will be used on `from $here import handler`
  // for example, `from api.users import handler`
  console.log('entrypoint is', entrypoint);
  const userHandlerFilePath = entrypoint
    .replace(/\//g, '.')
    .replace(/\.py$/, '');
  const nowHandlerPyContents = originalNowHandlerPyContents.replace(
    /__NOW_HANDLER_FILENAME/g,
    userHandlerFilePath,
  );

  // in order to allow the user to have `server.py`, we need our `server.py` to be called
  // somethig else
  const nowHandlerPyFilename = 'now__handler__python';

  await writeFile(
    join(workPath, `${nowHandlerPyFilename}.py`),
    nowHandlerPyContents,
  );

  const lambda = await createLambda({
    files: await glob('**', workPath),
    handler: `${nowHandlerPyFilename}.now_handler`,
    runtime: 'python3.6',
    environment: {},
  });

  return {
    [entrypoint]: lambda,
  };
};
