import { send } from 'micro';
import test from 'ava';
import sinon from 'sinon';
import fetch from 'node-fetch';
import { getProjectName } from '../src/util/get-project-name';
import { toHost } from '../src/util/to-host';
import wait from '../src/util/output/wait';
import { responseError } from '../src/util/error';
import getURL from './helpers/get-url';
import didYouMean from '../src/util/init/did-you-mean';
import { isValidName } from '../src/util/is-valid-name';
import getUpdateCommand from '../src/util/get-update-command';
import { isCanary } from '../src/util/is-canary';

test('simple to host', t => {
  t.is(toHost('zeit.co'), 'zeit.co');
});

test('leading // to host', t => {
  t.is(
    toHost('//zeit-logos-rnemgaicnc.now.sh'),
    'zeit-logos-rnemgaicnc.now.sh'
  );
});

test('leading http:// to host', t => {
  t.is(
    toHost('http://zeit-logos-rnemgaicnc.now.sh'),
    'zeit-logos-rnemgaicnc.now.sh'
  );
});

test('leading https:// to host', t => {
  t.is(
    toHost('https://zeit-logos-rnemgaicnc.now.sh'),
    'zeit-logos-rnemgaicnc.now.sh'
  );
});

test('leading https:// and path to host', t => {
  t.is(
    toHost('https://zeit-logos-rnemgaicnc.now.sh/path'),
    'zeit-logos-rnemgaicnc.now.sh'
  );
});

test('simple and path to host', t => {
  t.is(toHost('zeit.co/test'), 'zeit.co');
});

test('`wait` utility does not invoke spinner before n miliseconds', async t => {
  const oraStub = sinon.stub().returns({
    color: '',
    start: () => {},
    stop: () => {},
  });

  const timeOut = 200;
  const stop = wait('test', timeOut, oraStub);

  stop();

  t.truthy(oraStub.notCalled);
});

test('`wait` utility invokes spinner after n miliseconds', async t => {
  const oraStub = sinon.stub().returns({
    color: '',
    start: () => {},
    stop: () => {},
  });

  const timeOut = 200;

  const delayedWait = () =>
    new Promise(resolve => {
      const stop = wait('test', timeOut, oraStub);

      setTimeout(() => {
        resolve();
        stop();
      }, timeOut + 100);
    });

  await delayedWait();
  t.is(oraStub.calledOnce, true);
});

test('`wait` utility does not invoke spinner when stopped before delay', async t => {
  const oraStub = sinon.stub().returns({
    color: '',
    start: () => {},
    stop: () => {},
  });

  const timeOut = 200;

  const delayedWait = () =>
    new Promise(resolve => {
      const stop = wait('test', timeOut, oraStub);
      stop();

      setTimeout(() => {
        resolve();
      }, timeOut + 100);
    });

  await delayedWait();
  t.is(oraStub.notCalled, true);
});

test('4xx response error with fallback message', async t => {
  const fn = async (req, res) => {
    send(res, 404, {});
  };

  const url = await getURL(fn);
  const res = await fetch(url);
  const formatted = await responseError(res, 'Failed to load data');

  t.is(formatted.message, 'Failed to load data (404)');
});

test('4xx response error without fallback message', async t => {
  const fn = async (req, res) => {
    send(res, 404, {});
  };

  const url = await getURL(fn);
  const res = await fetch(url);
  const formatted = await responseError(res);

  t.is(formatted.message, 'Response Error (404)');
});

test('5xx response error without fallback message', async t => {
  const fn = async (req, res) => {
    send(res, 500, '');
  };

  const url = await getURL(fn);
  const res = await fetch(url);
  const formatted = await responseError(res);

  t.is(formatted.message, 'Response Error (500)');
});

test('4xx response error as correct JSON', async t => {
  const fn = async (req, res) => {
    send(res, 400, {
      error: {
        message: 'The request is not correct',
      },
    });
  };

  const url = await getURL(fn);
  const res = await fetch(url);
  const formatted = await responseError(res);

  t.is(formatted.message, 'The request is not correct (400)');
});

test('5xx response error as HTML', async t => {
  const fn = async (req, res) => {
    send(res, 500, 'This is a malformed error');
  };

  const url = await getURL(fn);
  const res = await fetch(url);
  const formatted = await responseError(res, 'Failed to process data');

  t.is(formatted.message, 'Failed to process data (500)');
});

test('5xx response error with random JSON', async t => {
  const fn = async (req, res) => {
    send(res, 500, {
      wrong: 'property',
    });
  };

  const url = await getURL(fn);
  const res = await fetch(url);
  const formatted = await responseError(res, 'Failed to process data');

  t.is(formatted.message, 'Failed to process data (500)');
});

test('getProjectName with argv - option 1', t => {
  const project = getProjectName({
    argv: {
      name: 'abc',
    },
  });
  t.is(project, 'abc');
});

test('getProjectName with argv - option 2', t => {
  const project = getProjectName({
    argv: {
      '--name': 'abc',
    },
  });
  t.is(project, 'abc');
});

test('getProjectName with now.json', t => {
  const project = getProjectName({
    argv: {},
    nowConfig: { name: 'abc' },
  });
  t.is(project, 'abc');
});

test('getProjectName with a file', t => {
  const project = getProjectName({
    argv: {},
    nowConfig: {},
    isFile: true,
  });
  t.is(project, 'files');
});

test('getProjectName with a multiple files', t => {
  const project = getProjectName({
    argv: {},
    nowConfig: {},
    paths: ['/tmp/aa/abc.png', '/tmp/aa/bbc.png'],
  });
  t.is(project, 'files');
});

test('getProjectName with a directory', t => {
  const project = getProjectName({
    argv: {},
    nowConfig: {},
    paths: ['/tmp/aa'],
  });
  t.is(project, 'aa');
});

test('4xx response error with broken JSON', async t => {
  const fn = async (req, res) => {
    send(res, 403, `122{"sss"`);
  };

  const url = await getURL(fn);
  const res = await fetch(url);
  const formatted = await responseError(res, 'Not authenticated');

  t.is(formatted.message, 'Not authenticated (403)');
});

test('4xx response error as correct JSON with more properties', async t => {
  const fn = async (req, res) => {
    send(res, 403, {
      error: {
        message: 'The request is not correct',
        additionalProperty: 'test',
      },
    });
  };

  const url = await getURL(fn);
  const res = await fetch(url);
  const formatted = await responseError(res);

  t.is(formatted.message, 'The request is not correct (403)');
  t.is(formatted.additionalProperty, 'test');
});

test('429 response error with retry header', async t => {
  const fn = async (req, res) => {
    res.setHeader('Retry-After', '20');

    send(res, 429, {
      error: {
        message: 'You were rate limited',
      },
    });
  };

  const url = await getURL(fn);
  const res = await fetch(url);
  const formatted = await responseError(res);

  t.is(formatted.message, 'You were rate limited (429)');
  t.is(formatted.retryAfter, 20);
});

test('429 response error without retry header', async t => {
  const fn = async (req, res) => {
    send(res, 429, {
      error: {
        message: 'You were rate limited',
      },
    });
  };

  const url = await getURL(fn);
  const res = await fetch(url);
  const formatted = await responseError(res);

  t.is(formatted.message, 'You were rate limited (429)');
  t.is(formatted.retryAfter, undefined);
});

test("guess user's intention with custom didYouMean", async t => {
  const examples = [
    'apollo',
    'create-react-app',
    'docz',
    'gatsby',
    'go',
    'gridsome',
    'html-minifier',
    'mdx-deck',
    'monorepo',
    'nextjs',
    'nextjs-news',
    'nextjs-static',
    'node-server',
    'nodejs',
    'nodejs-canvas-partyparrot',
    'nodejs-coffee',
    'nodejs-express',
    'nodejs-hapi',
    'nodejs-koa',
    'nodejs-koa-ts',
    'nodejs-pdfkit',
    'nuxt-static',
    'optipng',
    'php-7',
    'puppeteer-screenshot',
    'python',
    'redirect',
    'serverless-ssr-reddit',
    'static',
    'vue',
    'vue-ssr',
    'vuepress',
  ];

  t.is(didYouMean('md', examples, 0.7), 'mdx-deck');
  t.is(didYouMean('koa', examples, 0.7), 'nodejs-koa');
  t.is(didYouMean('node', examples, 0.7), 'nodejs');
  t.is(didYouMean('12345', examples, 0.7), undefined);
});

test('check valid name', async t => {
  t.is(isValidName('hello world'), true);
  t.is(isValidName('käse'), true);
  t.is(isValidName('ねこ'), true);
  t.is(isValidName('/'), false);
  t.is(isValidName('/#'), false);
  t.is(isValidName('//'), false);
  t.is(isValidName('/ねこ'), true);
  t.is(isValidName('привет'), true);
  t.is(isValidName('привет#'), true);
});

test('detect update command', async t => {
  const updateCommand = await getUpdateCommand();
  t.is(updateCommand, `yarn add now@${isCanary() ? 'canary' : 'latest'}`);
});
