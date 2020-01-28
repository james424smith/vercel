const { deepEqual } = require('assert');
const { normalizeRoutes } = require('../');
const {
  getCleanUrls,
  convertCleanUrls,
  convertRedirects,
  convertRewrites,
  convertHeaders,
  convertTrailingSlash,
} = require('../dist/superstatic');

function routesToRegExps(routeArray) {
  const { routes, error } = normalizeRoutes(routeArray);
  if (error) {
    throw error;
  }
  return routes.map(r => new RegExp(r.src));
}

function assertMatches(actual, matches, isExpectingMatch) {
  routesToRegExps(actual).forEach((r, i) => {
    matches[i].forEach(text => {
      deepEqual(r.test(text), isExpectingMatch, `${text} ${r.source}`);
    });
  });
}

function assertRegexMatches(actual, mustMatch, mustNotMatch) {
  assertMatches(actual, mustMatch, true);
  assertMatches(actual, mustNotMatch, false);
}

test('getCleanUrls', () => {
  const actual = getCleanUrls([
    'file.txt',
    'path/to/file.txt',
    'file.js',
    'path/to/file.js',
    'file.html',
    'path/to/file.html',
  ]);
  const expected = [
    {
      html: '/file.html',
      clean: '/file',
    },
    {
      html: '/path/to/file.html',
      clean: '/path/to/file',
    },
  ];
  deepEqual(actual, expected);
});

test('convertCleanUrls true', () => {
  const actual = convertCleanUrls(true);
  const expected = [
    {
      src: '^/(?:(.+)/)?index(?:\\.html)?/?$',
      headers: { Location: '/$1' },
      status: 308,
    },
    {
      src: '^/(.*)\\.html/?$',
      headers: { Location: '/$1' },
      status: 308,
    },
  ];
  deepEqual(actual, expected);

  const mustMatch = [
    ['/index', '/index.html', '/sub/index', '/sub/index.html'],
    ['/file.html', '/sub/file.html'],
  ];

  const mustNotMatch = [
    [
      '/someindex',
      '/someindex.html',
      '/indexAhtml',
      '/sub/someindex',
      '/sub/someindex.html',
      '/sub/indexAhtml',
    ],
    ['/filehtml', '/sub/filehtml'],
  ];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertCleanUrls true, trailingSlash true', () => {
  const actual = convertCleanUrls(true, true);
  const expected = [
    {
      src: '^/(?:(.+)/)?index(?:\\.html)?/?$',
      headers: { Location: '/$1/' },
      status: 308,
    },
    {
      src: '^/(.*)\\.html/?$',
      headers: { Location: '/$1/' },
      status: 308,
    },
  ];
  deepEqual(actual, expected);

  const mustMatch = [
    [
      '/index',
      '/index.html',
      '/sub/index',
      '/sub/index.html',
      '/index/',
      '/index.html/',
      '/sub/index/',
      '/sub/index.html/',
    ],
    ['/file.html', '/sub/file.html', '/file.html/', '/sub/file.html/'],
  ];

  const mustNotMatch = [
    [
      '/someindex',
      '/someindex.html',
      '/indexAhtml',
      '/sub/someindex',
      '/sub/someindex.html',
      '/sub/indexAhtml',
      '/someindex/',
      '/someindex.html/',
      '/indexAhtml/',
      '/sub/someindex/',
      '/sub/someindex.html/',
      '/sub/indexAhtml/',
    ],
    ['/filehtml', '/sub/filehtml', '/filehtml/', '/sub/filehtml/'],
  ];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertCleanUrls false', () => {
  const actual = convertCleanUrls(false);
  const expected = [];
  deepEqual(actual, expected);
});

test('convertRedirects', () => {
  const actual = convertRedirects([
    { source: '/some/old/path', destination: '/some/new/path' },
    { source: '/next(\\.js)?', destination: 'https://nextjs.org' },
    {
      source: '/proxy/(.*)',
      destination: 'https://www.firebase.com',
      statusCode: 302,
    },
    {
      source: '/proxy-regex/([a-zA-Z]{1,})',
      destination: 'https://firebase.com/$1',
    },
    {
      source: '/proxy-port/([a-zA-Z]{1,})',
      destination: 'https://firebase.com:8080/$1',
    },
    {
      source: '/projects/:id/:action',
      destination: '/projects.html',
    },
    { source: '/old/:segment/path', destination: '/new/path/:segment' },
    { source: '/catchall/:hello*', destination: '/catchall/:hello*/' },
    {
      source: '/another-catch/:hello+',
      destination: '/another-catch/:hello+/',
    },
    {
      source: '/feedback/((?!general).*)',
      destination: '/feedback/general',
    },
    { source: '/catchme/:id*', destination: '/api/user' },
    {
      source: '/hello/:world*',
      destination: '/something#:world*',
    },
  ]);

  const expected = [
    {
      src: '^\\/some\\/old\\/path$',
      headers: { Location: '/some/new/path' },
      status: 308,
    },
    {
      src: '^\\/next(\\.js)?$',
      headers: { Location: 'https://nextjs.org' },
      status: 308,
    },
    {
      src: '^\\/proxy(?:\\/(.*))$',
      headers: { Location: 'https://www.firebase.com' },
      status: 302,
    },
    {
      src: '^\\/proxy-regex(?:\\/([a-zA-Z]{1,}))$',
      headers: { Location: 'https://firebase.com/$1' },
      status: 308,
    },
    {
      src: '^\\/proxy-port(?:\\/([a-zA-Z]{1,}))$',
      headers: { Location: 'https://firebase.com:8080/$1' },
      status: 308,
    },
    {
      src: '^\\/projects(?:\\/([^\\/]+?))(?:\\/([^\\/]+?))$',
      headers: { Location: '/projects.html?id=$1&action=$2' },
      status: 308,
    },
    {
      src: '^\\/old(?:\\/([^\\/]+?))\\/path$',
      headers: { Location: '/new/path/$1?segment=$1' },
      status: 308,
    },
    {
      src: '^\\/catchall(?:\\/((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*))?$',
      headers: { Location: '/catchall/$1/?hello=$1' },
      status: 308,
    },
    {
      src: '^\\/another-catch(?:\\/((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*))$',
      headers: { Location: '/another-catch/$1/?hello=$1' },
      status: 308,
    },
    {
      src: '^\\/feedback(?:\\/((?!general).*))$',
      headers: { Location: '/feedback/general' },
      status: 308,
    },
    {
      src: '^\\/catchme(?:\\/((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*))?$',
      headers: { Location: '/api/user?id=$1' },
      status: 308,
    },
    {
      src: '^\\/hello(?:\\/((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*))?$',
      headers: { Location: '/something?world=$1#$1' },
      status: 308,
    },
  ];

  deepEqual(actual, expected);

  const mustMatch = [
    ['/some/old/path'],
    ['/next', '/next.js'],
    ['/proxy/one', '/proxy/2', '/proxy/-', '/proxy/dir/sub'],
    ['/proxy-regex/admin', '/proxy-regex/anotherAdmin'],
    ['/proxy-port/admin', '/proxy-port/anotherAdmin'],
    ['/projects/one/edit', '/projects/two/edit'],
    ['/old/one/path', '/old/two/path'],
    ['/catchall/first', '/catchall/first/second'],
    ['/another-catch/first', '/another-catch/first/second'],
    ['/feedback/another'],
    ['/catchme/id-1', '/catchme/id/2'],
    ['/hello/world', '/hello/another/world'],
  ];

  const mustNotMatch = [
    ['/nope'],
    ['/nextAjs', '/nextjs'],
    ['/prox', '/proxyed/two'],
    ['/proxy-regex/user/1', '/proxy-regex/another/1'],
    ['/proxy-port/user/1', '/proxy-port/another/1'],
    ['/projects/edit', '/projects/two/three/delete', '/projects'],
    ['/old/path', '/old/two/foo', '/old'],
    ['/random-catch'],
    ['/another-catch'],
    ['/feedback/general'],
    ['/catchm', '/random'],
    ['/not-this-one', '/helloo'],
  ];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertRewrites', () => {
  const actual = convertRewrites([
    { source: '/some/old/path', destination: '/some/new/path' },
    { source: '/proxy/(.*)', destination: 'https://www.firebase.com' },
    {
      source: '/proxy-regex/([a-zA-Z]{1,})',
      destination: 'https://firebase.com/$1',
    },
    {
      source: '/proxy-port/([a-zA-Z]{1,})',
      destination: 'https://firebase.com:8080/$1',
    },
    { source: '/projects/:id/edit', destination: '/projects.html' },
    {
      source: '/users/:id',
      destination: '/api/user?identifier=:id&version=v2',
    },
    {
      source: '/:file/:id',
      destination: '/:file/get?identifier=:id',
    },
    {
      source: '/qs-and-hash/:id/:hash',
      destination: '/api/get?identifier=:id#:hash',
    },
    {
      source: '/fullurl',
      destination:
        'https://user:pass@sub.example.com:8080/path/goes/here?v=1&id=2#hash',
    },
    {
      source: '/dont-override-qs/:name/:age',
      destination: '/final?name=bob&age=',
    },
    { source: '/catchall/:hello*/', destination: '/catchall/:hello*' },
    {
      source: '/another-catch/:hello+/',
      destination: '/another-catch/:hello+',
    },
    { source: '/catchme/:id*', destination: '/api/user' },
  ]);

  const expected = [
    { src: '^\\/some\\/old\\/path$', dest: '/some/new/path', check: true },
    {
      src: '^\\/proxy(?:\\/(.*))$',
      dest: 'https://www.firebase.com',
      check: true,
    },
    {
      src: '^\\/proxy-regex(?:\\/([a-zA-Z]{1,}))$',
      dest: 'https://firebase.com/$1',
      check: true,
    },
    {
      src: '^\\/proxy-port(?:\\/([a-zA-Z]{1,}))$',
      dest: 'https://firebase.com:8080/$1',
      check: true,
    },
    {
      src: '^\\/projects(?:\\/([^\\/]+?))\\/edit$',
      dest: '/projects.html?id=$1',
      check: true,
    },
    {
      src: '^\\/users(?:\\/([^\\/]+?))$',
      dest: '/api/user?identifier=$1&version=v2&id=$1',
      check: true,
    },
    {
      src: '^(?:\\/([^\\/]+?))(?:\\/([^\\/]+?))$',
      dest: '/$1/get?identifier=$2&file=$1&id=$2',
      check: true,
    },
    {
      src: '^\\/qs-and-hash(?:\\/([^\\/]+?))(?:\\/([^\\/]+?))$',
      dest: '/api/get?identifier=$1&id=$1&hash=$2#$2',
      check: true,
    },
    {
      src: '^\\/fullurl$',
      dest:
        'https://user:pass@sub.example.com:8080/path/goes/here?v=1&id=2#hash',
      check: true,
    },
    {
      src: '^\\/dont-override-qs(?:\\/([^\\/]+?))(?:\\/([^\\/]+?))$',
      dest: '/final?name=bob&age=',
      check: true,
    },
    {
      src: '^\\/catchall(?:\\/((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*))?\\/$',
      dest: '/catchall/$1?hello=$1',
      check: true,
    },
    {
      src: '^\\/another-catch(?:\\/((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*))\\/$',
      dest: '/another-catch/$1?hello=$1',
      check: true,
    },
    {
      src: '^\\/catchme(?:\\/((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*))?$',
      dest: '/api/user?id=$1',
      check: true,
    },
  ];

  deepEqual(actual, expected);

  const mustMatch = [
    ['/some/old/path'],
    ['/proxy/one', '/proxy/two'],
    ['/proxy-regex/admin', '/proxy-regex/anotherAdmin'],
    ['/proxy-port/admin', '/proxy-port/anotherAdmin'],
    ['/projects/one/edit', '/projects/two/edit'],
    ['/users/four', '/users/five'],
    ['/file1/yep', '/file2/nope'],
    ['/qs-and-hash/test/first', '/qs-and-hash/test/second'],
    ['/fullurl'],
    ['/dont-override-qs/bob/42', '/dont-override-qs/alice/29'],
    ['/catchall/first/', '/catchall/first/second/'],
    ['/another-catch/first/', '/another-catch/first/second/'],
    ['/catchme/id-1', '/catchme/id/2'],
  ];

  const mustNotMatch = [
    ['/nope'],
    ['/prox', '/proxyed/two'],
    ['/proxy-regex/user/1', '/proxy-regex/another/1'],
    ['/proxy-port/user/1', '/proxy-port/another/1'],
    ['/projects/edit', '/projects/two/delete', '/projects'],
    ['/users/edit/four', '/users/five/delete', '/users'],
    ['/'],
    ['/qs-and-hash', '/qs-and-hash/onlyone'],
    ['/full'],
    ['/dont-override-qs', '/dont-override-qs/nope'],
    ['/random-catch/'],
    ['/another-catch/'],
    ['/catchm', '/random'],
  ];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertHeaders', () => {
  const actual = convertHeaders([
    {
      source: '(.*)+/(.*)\\.(eot|otf|ttf|ttc|woff|font\\.css)',
      headers: [
        {
          key: 'Access-Control-Allow-Origin',
          value: '*',
        },
      ],
    },
    {
      source: '404.html',
      headers: [
        {
          key: 'Cache-Control',
          value: 'max-age=300',
        },
        {
          key: 'Set-Cookie',
          value: 'error=404',
        },
      ],
    },
    {
      source: '/blog/:path*',
      headers: [
        {
          key: 'on-blog',
          value: ':path*',
        },
        {
          key: ':path*',
          value: 'blog',
        },
      ],
    },
  ]);

  const expected = [
    {
      src: '^(.*)+(?:\\/(.*))\\.(eot|otf|ttf|ttc|woff|font\\.css)$',
      headers: { 'Access-Control-Allow-Origin': '*' },
      continue: true,
    },
    {
      src: '^404\\.html$',
      headers: { 'Cache-Control': 'max-age=300', 'Set-Cookie': 'error=404' },
      continue: true,
    },
    {
      src: '^\\/blog(?:\\/((?:[^\\/]+?)(?:\\/(?:[^\\/]+?))*))?$',
      headers: { 'on-blog': '$1', $1: 'blog' },
      continue: true,
    },
  ];

  deepEqual(actual, expected);

  const mustMatch = [
    ['hello/world/file.eot', 'another/font.ttf', 'dir/arial.font.css'],
    ['404.html'],
    ['/blog/first-post', '/blog/another/one'],
  ];

  const mustNotMatch = [
    ['hello/file.jpg', 'hello/font-css', 'dir/arial.font-css'],
    ['403.html', '500.html'],
    ['/blogg', '/random'],
  ];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertTrailingSlash enabled', () => {
  const actual = convertTrailingSlash(true);
  const expected = [
    {
      src: '^/(.*[^\\/])$',
      headers: { Location: '/$1/' },
      status: 308,
    },
  ];
  deepEqual(actual, expected);

  const mustMatch = [['/index.html', '/dir', '/dir/index.html', '/foo/bar']];

  const mustNotMatch = [['/', '/dir/', '/dir/foo/', '/next.php?page=/']];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});

test('convertTrailingSlash disabled', () => {
  const actual = convertTrailingSlash(false);
  const expected = [
    {
      src: '^/(.*)\\/$',
      headers: { Location: '/$1' },
      status: 308,
    },
  ];
  deepEqual(actual, expected);

  const mustMatch = [['/dir/', '/index.html/', '/next.php?page=/']];

  const mustNotMatch = [['/dirp', '/mkdir', '/dir/foo']];

  assertRegexMatches(actual, mustMatch, mustNotMatch);
});
