
0.24.1 / 2016-09-09
===================

  * add `ignore` dep

0.24.0 / 2016-09-09
===================

  * now rm: remove by app name [@rauchg]
  * fix ignore implementation [@rauchg]
  * bump pkg to 3.0.0-beta.6 [@rauchg]
  * make indendation consistent in listings [@rauchg]
  * add totals to listings and fix plurals [@rauchg]

0.23.1 / 2016-09-05
===================

  * workaround for node-spdy bug
  * index: filter empty entries
  * alias: improve error
  * fix whois-ns-fallback request once again (#143)

0.23.0 / 2016-09-02
===================

  * add `-e` [@rauchg]
  * add `now secret` [@rauchg]
  * fix Docker CMD docs link (#124) [@tootallnate]
  * Use "cross-spawn" instead of "cross-spawn-async" (#125) [@tootallnate]

0.22.0 / 2016-08-26
===================

  * hide secrets for now
  * Add --token and --config options
  * don't use domain-regex
  * warn about removing bound aliases when removing a domain
  * stop minifying the code

0.21.1 / 2016-08-17
===================

  * fix for windows [@rauchg]

0.21.0 / 2016-08-16
==================

  * fix exceptions
  * domain add: try fallback if the list of name servers is empty [@hbp]
  * show a proper error message for protected domain names [@hbp]

0.20.0 / 2016-08-16
==================

  * docker support

0.19.0 / 2016-07-22
===================

  * alias: handle `ESERVFAIL` [@rauchg]
  * add cmd line flag to forward NPM auth token [@rase-]
  * make a binary of `now` using enclosejs [@igorklopov]
  * bunch of misc improvements to build process [@leo]

0.18.1 / 2016-06-23
===================

  * fix node build

0.18.0 / 2016-06-23
===================

  * don't use http2 agent when `--url` is set [@nkzawa]
  * send user-agent on login [@nkzawa]
  * removing a deployment warns about alias removal [@rauchg]
  * improve error handling for certificates [@rauchg]
  * improve alias message [@rauchg]
  * improve alias listing style [@rauchg]
  * add automatic DNS records configuration [@rauchg]
  * add support for `now domains` [@rauchg]

0.17.1 / 2016-06-07
===================

  * package: bump `email-prompt` for windows fix [@nkzawa]

0.17.0 / 2016-06-06
===================

  * index: add support for `engines` [@rauchg]
  * index: add version reporting to CLI [@rauchg]
  * login: add support for token name [@nkzawa]

0.16.0 / 2016-06-03
===================

  * now-deploy: add "initializing" message [@rauchg]
  * Use `"now"` nampespace for `"engines"` [@rase-]

0.15.0 / 2016-05-30
===================

  * HTTP/2
  * now-alias
  * `async-retry` bump to fix `onRetry`

0.14.4 / 2016-05-23
===================

  * implement `async-retry` [@rauchg]
  * fix debug [@rauchg]

0.14.3 / 2016-05-23
===================

  * Revert "add http2 support back" [@rauchg]

0.14.2 / 2016-05-23
===================

  * improvements to `--login` [@rauchg]

0.14.1 / 2016-05-23
===================

  * remove .next from ignored [@rauchg]
  * add support for `email-prompt` [@rauchg]

0.14.0 / 2016-05-22
===================

  * add email validation and input retrying [@rauchg]
  * add http2 support back [@rauchg]

0.13.3 / 2016-05-17
==================

  * npm publish bugfix

0.13.2 / 2016-05-14
===================

  * remove `test` and `tests` from ignored files

0.13.1 / 2016-05-12
==================

  * fix zeit endpoints [@rauchg]

0.13.0 / 2016-05-12
===================

  * add warning reports for `/create` [@rauchg, @rase-]
  * migrate to `api.zeit.co` [@rauchg]

0.12.0 / 2016-04-29
===================

  * fix multiple files with same sha [@rase-]

0.11.0 / 2016-04-24
===================

  * improve error for wrong directory [@rauchg]
  * improved help [@rauchg]
  * now-rm [@rase-]

0.10.2 / 2016-04-23
==================

  * Fix path handling for windows [@rase-]

0.10.1 / 2016-04-22
==================

  * fix subcommands (including deploying) on windows [@nkzawa]

0.10.0 / 2016-04-19
===================

  * display default help if wrong command was specified [@nkzawa]
  * add the `help` command [@nkzawa]
  * add base command [@nkzawa]
  * add `now-list` [@nkzawa]
  * bin/now -> bin/now-deploy [@nkzawa]
  * add `now-rm` (hidden) [@rase-]

0.9.19 / 2016-04-06
===================

  * fix windows [@rase-]

0.9.18 / 2016-04-06
==================

  * if file not found at all, don't attempt to list it [@rase-]

0.9.17 / 2016-04-06
===================

  * remove spdy temporarily [@rauchg]

0.9.16 / 2016-04-01
===================

  * always print deployment status [@rauchg]

0.9.15 / 2016-04-01
===================

  * print logs from build [@rauchg]
  * fix unwanted bails in retrying logic [@rase-]
  * ignore update checking if no tty [@rauchg]
  * add messages for rate limit exceeded error [@nkzawa]
  * check for updates upon `-h` and `-v` [@rauchg]

0.9.14 / 2016-03-17
===================

  * index: support `now-start` [@rauchg]

0.9.13 / 2016-03-12
===================

  * index: validate `name` in package.json [@rauchg]

0.9.12 / 2016-03-12
===================

  * login: use https for `api.now.sh` [@rauchg]

0.9.11 / 2016-03-12
===================

  * fix registration url [@rauchg]

0.9.10 / 2016-03-12
===================

  * delete post-install [@rauchg]

0.9.9 / 2016-03-12
==================

  * now: expose version [@rauchg]

0.9.8 / 2016-03-12
==================

  * cap maximum concurrent uploads due to HTTP/2 streams limit [@rauchg]
  * make login resolve token [@rase-]

0.9.7 / 2016-03-10
==================

  * Add `-F, --forceSync` flag [@rauchg]

0.9.6 / 2016-03-04
==================

  * send files as buffers [@rase-]
  * simplify cfg reading / merging [@rauchg]
  * ignored: ignore `.dockerignore` [@rauchg]
  * add auto updater with support for timeout, exit handler [@rauchg]
  * package: bump `gulp-eslint` to work with latest eslint [@rauchg]
  * fix eslint [@rauchg]

0.9.5 / 2016-03-04
==================

  * login: fix usage of `Object.assign` [@rauchg]
  * post-install: improve error handling [@rauchg]
  * post-install: make runnable as script [@rauchg]
  * package: use `build/scripts` for postinstall [@rauchg]
  * index: fallback to directory name [@rauchg]
  * index: send `package.json` metadata like `name` [@rauchg]

0.9.4 / 2016-03-03
==================

  * login: extend configuration instead of overwriting it [@rauchg]

0.9.3 / 2016-03-03
==================

  * more debug information [@rauchg]

0.9.2 / 2016-03-03
==================

  * update ignores list [@rauchg]

0.9.1 / 2016-03-03
==================

  * index: throw error if `start` is not defined. [@rauchg]
  * now: revert usage of `now` [@rauchg]
  * package: simplify `files` [@rauchg]

0.9.0 / 2016-03-03
==================

  * initial release
