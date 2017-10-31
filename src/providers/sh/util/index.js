// Native
const { homedir } = require('os')
const { resolve: resolvePath } = require('path')
const EventEmitter = require('events')
const qs = require('querystring')
const { parse: parseUrl } = require('url')

// Packages
const fetch = require('node-fetch')
const bytes = require('bytes')
const chalk = require('chalk')
const through2 = require('through2')
const retry = require('async-retry')
const { parse: parseIni } = require('ini')
const { readFile, stat, lstat } = require('fs-extra')
const ms = require('ms')

// Utilities
const {
  staticFiles: getFiles,
  npm: getNpmFiles,
  docker: getDockerFiles
} = require('./get-files')
const ua = require('./ua')
const hash = require('./hash')
const Agent = require('./agent')
const toHost = require('./to-host')
const { responseError } = require('./error')

// How many concurrent HTTP/2 stream uploads
const MAX_CONCURRENT = 50

// Check if running windows
const IS_WIN = process.platform.startsWith('win')
const SEP = IS_WIN ? '\\' : '/'

module.exports = class Now extends EventEmitter {
  constructor({ apiUrl, token, currentTeam, forceNew = false, debug = false }) {
    super()
    this._token = token
    this._debug = debug
    this._forceNew = forceNew
    this._agent = new Agent(apiUrl, { debug })
    this._onRetry = this._onRetry.bind(this)
    this.currentTeam = currentTeam
  }

  async create(
    path,
    {
      wantsPublic,
      quiet = false,
      env = {},
      followSymlinks = true,
      forceNew = false,
      forwardNpm = false,

      // From readMetaData
      name,
      description,
      type = 'npm',
      pkg = {},
      nowConfig = {},
      hasNowJson = false,
      sessionAffinity = 'ip'
    }
  ) {
    this._path = path

    let files
    let engines

    if (this._debug) {
      console.time('> [debug] Getting files')
    }

    const opts = { debug: this._debug, hasNowJson }
    if (type === 'npm') {
      files = await getNpmFiles(path, pkg, nowConfig, opts)

      // A `start` or `now-start` npm script, or a `server.js` file
      // in the root directory of the deployment are required
      if (!hasNpmStart(pkg) && !hasFile(path, files, 'server.js')) {
        const err = new Error(
          'Missing `start` (or `now-start`) script in `package.json`. ' +
            'See: https://docs.npmjs.com/cli/start.'
        )
        err.userError = true
        throw err
      }

      engines = nowConfig.engines || pkg.engines
      forwardNpm = forwardNpm || nowConfig.forwardNpm
    } else if (type === 'static') {
      files = await getFiles(path, nowConfig, opts)
    } else if (type === 'docker') {
      files = await getDockerFiles(path, nowConfig, opts)
    }

    if (this._debug) {
      console.timeEnd('> [debug] Getting files')
    }

    // Read `registry.npmjs.org` authToken from .npmrc
    let authToken
    if (type === 'npm' && forwardNpm) {
      authToken =
        (await readAuthToken(path)) || (await readAuthToken(homedir()))
    }

    if (this._debug) {
      console.time('> [debug] Computing hashes')
    }

    const pkgDetails = Object.assign({ name }, pkg)
    const hashes = await hash(files, pkgDetails)

    if (this._debug) {
      console.timeEnd('> [debug] Computing hashes')
    }

    this._files = hashes

    const deployment = await this.retry(async bail => {
      if (this._debug) {
        console.time('> [debug] v2/now/deployments')
      }

      // Flatten the array to contain files to sync where each nested input
      // array has a group of files with the same sha but different path
      const files = await Promise.all(
        Array.prototype.concat.apply(
          [],
          await Promise.all(
            Array.from(this._files).map(async ([sha, { data, names }]) => {
              const statFn = followSymlinks ? stat : lstat

              return names.map(async name => {
                const getMode = async () => {
                  const st = await statFn(name)
                  return st.mode
                }

                const mode = await getMode()

                return {
                  sha,
                  size: data.length,
                  file: toRelative(name, this._path),
                  mode
                }
              })
            })
          )
        )
      )

      const res = await this._fetch('/v2/now/deployments', {
        method: 'POST',
        body: {
          env,
          public: wantsPublic || nowConfig.public,
          forceNew,
          name,
          description,
          deploymentType: type,
          registryAuthToken: authToken,
          files,
          engines,
          sessionAffinity
        }
      })

      if (this._debug) {
        console.timeEnd('> [debug] v2/now/deployments')
      }

      // No retry on 4xx
      let body
      try {
        body = await res.json()
      } catch (err) {
        throw new Error('Unexpected response')
      }

      if (res.status === 429) {
        let msg = `You reached your 20 deployments limit in the OSS plan.\n`
        msg += `${chalk.gray('>')} Please run ${chalk.gray('`')}${chalk.cyan(
          'now upgrade'
        )}${chalk.gray('`')} to proceed`
        const err = new Error(msg)
        err.status = res.status
        err.retryAfter = 'never'
        return bail(err)
      } else if (res.status === 400 && body.error && body.error.code === 'missing_files') {
        return body
      } else if (res.status >= 400 && res.status < 500) {
        const err = new Error(body.error.message)
        err.userError = true
        return bail(err)
      } else if (res.status !== 200) {
        throw new Error(body.error.message)
      }

      return body
    })

    // We report about files whose sizes are too big
    let missingVersion = false
    if (deployment.warnings) {
      let sizeExceeded = 0
      deployment.warnings.forEach(warning => {
        if (warning.reason === 'size_limit_exceeded') {
          const { sha, limit } = warning
          const n = hashes.get(sha).names.pop()
          console.error(
            '> \u001B[31mWarning!\u001B[39m Skipping file %s (size exceeded %s)',
            n,
            bytes(limit)
          )
          hashes.get(sha).names.unshift(n) // Move name (hack, if duplicate matches we report them in order)
          sizeExceeded++
        } else if (warning.reason === 'node_version_not_found') {
          const { wanted, used } = warning
          console.error(
            '> \u001B[31mWarning!\u001B[39m Requested node version %s is not available',
            wanted,
            used
          )
          missingVersion = true
        }
      })

      if (sizeExceeded) {
        console.error(
          `> \u001B[31mWarning!\u001B[39m ${sizeExceeded} of the files ` +
            'exceeded the limit for your plan.\n' +
            `> Please run ${chalk.gray('`')}${chalk.cyan(
              'now upgrade'
            )}${chalk.gray('`')} to upgrade.`
        )
      }
    }

    if (deployment.error && deployment.error.code === 'missing_files') {
      this._missing = deployment.error.missing || []
      this._fileCount = files.length
      return null;
    }

    if (!quiet && type === 'npm' && deployment.nodeVersion) {
      if (engines && engines.node) {
        if (missingVersion) {
          console.log(
            `> Using Node.js ${chalk.bold(deployment.nodeVersion)} (default)`
          )
        } else {
          console.log(
            `> Using Node.js ${chalk.bold(
              deployment.nodeVersion
            )} (requested: ${chalk.dim(`\`${engines.node}\``)})`
          )
        }
      } else {
        console.log(
          `> Using Node.js ${chalk.bold(deployment.nodeVersion)} (default)`
        )
      }
    }

    this._id = deployment.deploymentId
    this._host = deployment.url
    this._missing = []
    this._fileCount = files.length

    return this._url
  }

  upload() {
    if (this._debug) {
      console.log(
        '> [debug] Will upload ' +
          `${this._missing.length} files`
      )
    }

    this._agent.setConcurrency({
      maxStreams: MAX_CONCURRENT,
      capacity: this._missing.length
    })

    console.time('> [debug] Uploading files')
    Promise.all(
      this._missing.map(sha =>
        retry(
          async (bail, attempt) => {
            const file = this._files.get(sha)
            const { data, names } = file

            if (this._debug) {
              console.time(`> [debug] v2/now/files #${attempt} ${names.join(' ')}`)
            }

            const stream = through2()
            stream.write(data)
            stream.end()
            const res = await this._fetch('/v2/now/files', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/octet-stream',
                'Content-Length': data.length,
                'x-now-digest': sha,
                'x-now-file': names
                  .map(name => {
                    return toRelative(encodeURIComponent(name), this._path)
                  })
                  .join(','),
                'x-now-size': data.length
              },
              body: stream
            })

            if (this._debug) {
              console.timeEnd(
                `> [debug] v2/now/files #${attempt} ${names.join(' ')}`
              )
            }

            // No retry on 4xx
            if (
              res.status !== 200 &&
              (res.status >= 400 || res.status < 500)
            ) {
              if (this._debug) {
                console.log(
                  '> [debug] bailing on creating due to %s',
                  res.status
                )
              }

              return bail(await responseError(res))
            }

            this.emit('upload', file)
          },
          { retries: 3, randomize: true, onRetry: this._onRetry }
        )
      )
    )
      .then(() => (console.timeEnd('> [debug] Uploading files') || this.emit('complete')))
      .catch(err => this.emit('error', err))
  }

  async listSecrets() {
    return this.retry(async (bail, attempt) => {
      if (this._debug) {
        console.time(`> [debug] #${attempt} GET /secrets`)
      }

      const res = await this._fetch('/now/secrets')

      if (this._debug) {
        console.timeEnd(`> [debug] #${attempt} GET /secrets`)
      }

      const body = await res.json()
      return body.secrets
    })
  }

  async list(app) {
    const query = app ? `?app=${encodeURIComponent(app)}` : ''

    const { deployments } = await this.retry(
      async bail => {
        if (this._debug) {
          console.time('> [debug] /list')
        }

        const res = await this._fetch('/now/list' + query)

        if (this._debug) {
          console.timeEnd('> [debug] /list')
        }

        // No retry on 4xx
        if (res.status >= 400 && res.status < 500) {
          if (this._debug) {
            console.log('> [debug] bailing on listing due to %s', res.status)
          }
          return bail(await responseError(res))
        }

        if (res.status !== 200) {
          throw new Error('Fetching deployment url failed')
        }

        return res.json()
      },
      { retries: 3, minTimeout: 2500, onRetry: this._onRetry }
    )

    return deployments
  }

  async listInstances(deploymentId) {
    const { instances } = await this.retry(
      async bail => {
        if (this._debug) {
          console.time(`> [debug] /deployments/${deploymentId}/instances`)
        }

        const res = await this._fetch(
          `/now/deployments/${deploymentId}/instances`
        )

        if (this._debug) {
          console.timeEnd(`> [debug] /deployments/${deploymentId}/instances`)
        }

        // No retry on 4xx
        if (res.status >= 400 && res.status < 500) {
          if (this._debug) {
            console.log('> [debug] bailing on listing due to %s', res.status)
          }
          return bail(await responseError(res))
        }

        if (res.status !== 200) {
          throw new Error('Fetching instances list failed')
        }

        return res.json()
      },
      { retries: 3, minTimeout: 2500, onRetry: this._onRetry }
    )

    return instances
  }

  async findDeployment(deployment) {
    const list = await this.list()

    let key
    let val

    if (/\./.test(deployment)) {
      val = toHost(deployment)
      key = 'url'
    } else {
      val = deployment
      key = 'uid'
    }

    const depl = list.find(d => {
      if (d[key] === val) {
        if (this._debug) {
          console.log(`> [debug] matched deployment ${d.uid} by ${key} ${val}`)
        }

        return true
      }

      // Match prefix
      if (`${val}.now.sh` === d.url) {
        if (this._debug) {
          console.log(`> [debug] matched deployment ${d.uid} by url ${d.url}`)
        }

        return true
      }

      return false
    })

    return depl
  }

  async logs(
    deploymentIdOrURL,
    { instanceId, types, limit, query, since, until } = {}
  ) {
    const q = qs.stringify({
      instanceId,
      types: types.join(','),
      limit,
      q: query,
      since,
      until
    })

    const { logs } = await this.retry(
      async bail => {
        if (this._debug) {
          console.time('> [debug] /logs')
        }

        const url = `/now/deployments/${encodeURIComponent(
          deploymentIdOrURL
        )}/logs?${q}`
        const res = await this._fetch(url)

        if (this._debug) {
          console.timeEnd('> [debug] /logs')
        }

        // No retry on 4xx
        if (res.status >= 400 && res.status < 500) {
          if (this._debug) {
            console.log(
              '> [debug] bailing on printing logs due to %s',
              res.status
            )
          }

          return bail(await responseError(res))
        }

        if (res.status !== 200) {
          throw new Error('Fetching deployment logs failed')
        }

        return res.json()
      },
      {
        retries: 3,
        minTimeout: 2500,
        onRetry: this._onRetry
      }
    )

    return logs
  }

  async listAliases(deploymentId) {
    return this.retry(async bail => {
      const res = await this._fetch(
        deploymentId
          ? `/now/deployments/${deploymentId}/aliases`
          : '/now/aliases'
      )

      if (res.status >= 400 && res.status < 500) {
        if (this._debug) {
          console.log('> [debug] bailing on get domain due to %s', res.status)
        }
        return bail(await responseError(res))
      }

      if (res.status !== 200) {
        throw new Error('API error getting aliases')
      }

      const body = await res.json()
      return body.aliases
    })
  }

  async last(app) {
    const deployments = await this.list(app)

    const last = deployments
      .sort((a, b) => {
        return b.created - a.created
      })
      .shift()

    if (!last) {
      const e = Error(`No deployments found for "${app}"`)
      e.userError = true
      throw e
    }

    return last
  }

  async listDomains() {
    return this.retry(async (bail, attempt) => {
      if (this._debug) {
        console.time(`> [debug] #${attempt} GET /domains`)
      }

      const res = await this._fetch('/domains')

      if (this._debug) {
        console.timeEnd(`> [debug] #${attempt} GET /domains`)
      }

      if (res.status >= 400 && res.status < 500) {
        if (this._debug) {
          console.log('> [debug] bailing on get domain due to %s', res.status)
        }
        return bail(await responseError(res))
      }

      if (res.status !== 200) {
        throw new Error('API error getting domains')
      }

      const body = await res.json()
      return body.domains
    })
  }

  async getDomain(domain) {
    return this.retry(async (bail, attempt) => {
      if (this._debug) {
        console.time(`> [debug] #${attempt} GET /domains/${domain}`)
      }

      const res = await this._fetch(`/domains/${domain}`)

      if (res.status >= 400 && res.status < 500) {
        if (this._debug) {
          console.log('> [debug] bailing on get domain due to %s', res.status)
        }
        return bail(await responseError(res))
      }

      if (res.status !== 200) {
        throw new Error('API error getting domain name')
      }

      if (this._debug) {
        console.timeEnd(`> [debug] #${attempt} GET /domains/${domain}`)
      }

      return res.json()
    })
  }

  getNameservers(domain) {
    return new Promise((resolve, reject) => {
      let fallback = false

      this.retry(async (bail, attempt) => {
        if (this._debug) {
          console.time(
            `> [debug] #${attempt} GET /whois-ns${fallback ? '-fallback' : ''}`
          )
        }

        const res = await this._fetch(
          `/whois-ns${fallback ? '-fallback' : ''}?domain=${encodeURIComponent(
            domain
          )}`
        )

        if (this._debug) {
          console.timeEnd(
            `> [debug] #${attempt} GET /whois-ns${fallback ? '-fallback' : ''}`
          )
        }

        const body = await res.json()

        if (res.status === 200) {
          if (
            (!body.nameservers || body.nameservers.length === 0) &&
            !fallback
          ) {
            // If the nameservers are `null` it's likely
            // that our whois service failed to parse it
            fallback = true
            throw new Error('Invalid whois response')
          }

          return body
        }

        if (attempt > 1) {
          fallback = true
        }

        throw new Error(`Whois error (${res.status}): ${body.error.message}`)
      })
        .then(body => {
          body.nameservers = body.nameservers.filter(ns => {
            // Temporary hack:
            // sometimes we get a response that looks like:
            // ['ns', 'ns', '', '']
            // so we filter the empty ones
            return ns.length
          })
          resolve(body)
        })
        .catch(err => {
          reject(err)
        })
    })
  }

  // _ensures_ the domain is setup (idempotent)
  setupDomain(name, { isExternal } = {}) {
    return this.retry(async (bail, attempt) => {
      if (this._debug) {
        console.time(`> [debug] #${attempt} POST /domains`)
      }

      const res = await this._fetch('/domains', {
        method: 'POST',
        body: { name, isExternal: Boolean(isExternal) }
      })

      if (this._debug) {
        console.timeEnd(`> [debug] #${attempt} POST /domains`)
      }

      const body = await res.json()

      if (res.status === 403) {
        const code = body.error.code
        let err

        if (code === 'custom_domain_needs_upgrade') {
          err = new Error(
            `Custom domains are only enabled for premium accounts. Please upgrade at ${chalk.underline(
              'https://zeit.co/account'
            )}.`
          )
        } else {
          err = new Error(`Not authorized to access domain ${name}`)
        }

        err.userError = true
        return bail(err)
      } else if (res.status === 409) {
        // Domain already exists
        if (this._debug) {
          console.log('> [debug] Domain already exists (noop)')
        }

        return { uid: body.error.uid, code: body.error.code }
      } else if (
        res.status === 401 &&
        body.error &&
        body.error.code === 'verification_failed'
      ) {
        throw new Error(body.error.message)
      } else if (res.status !== 200) {
        throw new Error(body.error.message)
      }

      return body
    })
  }

  createCert(domain, { renew } = {}) {
    return this.retry(
      async (bail, attempt) => {
        if (this._debug) {
          console.time(`> [debug] /now/certs #${attempt}`)
        }

        const res = await this._fetch('/now/certs', {
          method: 'POST',
          body: {
            domains: [domain],
            renew
          }
        })

        if (res.status === 304) {
          console.log('> Certificate already issued.')
          return
        }

        const body = await res.json()

        if (this._debug) {
          console.timeEnd(`> [debug] /now/certs #${attempt}`)
        }

        if (body.error) {
          const { code } = body.error

          if (code === 'verification_failed') {
            const err = new Error(
              'The certificate issuer failed to verify ownership of the domain. ' +
                'This likely has to do with DNS propagation and caching issues. Please retry later!'
            )
            err.userError = true
            // Retry
            throw err
          } else if (code === 'rate_limited') {
            const err = new Error(body.error.message)
            err.userError = true
            // Dont retry
            return bail(err)
          }

          throw new Error(body.error.message)
        }

        if (res.status !== 200 && res.status !== 304) {
          throw new Error('Unhandled error')
        }
        return body
      },
      { retries: 3, minTimeout: 30000, maxTimeout: 90000 }
    )
  }

  deleteCert(domain) {
    return this.retry(
      async (bail, attempt) => {
        if (this._debug) {
          console.time(`> [debug] /now/certs #${attempt}`)
        }

        const res = await this._fetch(`/now/certs/${domain}`, {
          method: 'DELETE'
        })

        if (res.status !== 200) {
          const err = new Error(res.body.error.message)
          err.userError = false

          if (res.status === 400 || res.status === 404) {
            return bail(err)
          }

          throw err
        }
      },
      { retries: 3 }
    )
  }

  async remove(deploymentId, { hard }) {
    const data = { deploymentId, hard }

    await this.retry(async bail => {
      if (this._debug) {
        console.time('> [debug] /remove')
      }

      const res = await this._fetch('/now/remove', {
        method: 'DELETE',
        body: data
      })

      if (this._debug) {
        console.timeEnd('> [debug] /remove')
      }

      // No retry on 4xx
      if (res.status >= 400 && res.status < 500) {
        if (this._debug) {
          console.log('> [debug] bailing on removal due to %s', res.status)
        }
        return bail(await responseError(res))
      }

      if (res.status !== 200) {
        throw new Error('Removing deployment failed')
      }
    })

    return true
  }

  retry(fn, { retries = 3, maxTimeout = Infinity } = {}) {
    return retry(fn, {
      retries,
      maxTimeout,
      onRetry: this._onRetry
    })
  }

  _onRetry(err) {
    if (this._debug) {
      console.log(`> [debug] Retrying: ${err}\n${err.stack}`)
    }
  }

  close() {
    this._agent.close()
  }

  get id() {
    return this._id
  }

  get url() {
    return `https://${this._host}`
  }

  get fileCount() {
    return this._fileCount
  }

  get host() {
    return this._host
  }

  get syncAmount() {
    if (!this._syncAmount) {
      this._syncAmount = this._missing
        .map(sha => this._files.get(sha).data.length)
        .reduce((a, b) => a + b, 0)
    }
    return this._syncAmount
  }

  get syncFileCount() {
    return this._missing.length
  }

  _fetch(_url, opts = {}) {
    if (opts.useCurrentTeam !== false && this.currentTeam) {
      const parsedUrl = parseUrl(_url, true)
      const query = parsedUrl.query

      query.teamId = this.currentTeam.id
      _url = `${parsedUrl.pathname}?${qs.encode(query)}`
      delete opts.useCurrentTeam
    }

    opts.headers = opts.headers || {}
    opts.headers.authorization = `Bearer ${this._token}`
    opts.headers['user-agent'] = ua
    return this._agent.fetch(_url, opts)
  }

  setScale(nameOrId, scale) {
    return this.retry(
      async (bail, attempt) => {
        if (this._debug) {
          console.time(
            `> [debug] #${attempt} POST /deployments/${nameOrId}/instances`
          )
        }

        const res = await this._fetch(
          `/now/deployments/${nameOrId}/instances`,
          {
            method: 'POST',
            body: scale
          }
        )

        if (this._debug) {
          console.timeEnd(
            `> [debug] #${attempt} POST /deployments/${nameOrId}/instances`
          )
        }

        if (res.status === 403) {
          return bail(new Error('Unauthorized'))
        }

        const body = await res.json()

        if (res.status !== 200) {
          if (res.status === 404 || res.status === 400) {
            if (
              body &&
              body.error &&
              body.error.code &&
              body.error.code === 'not_snapshotted'
            ) {
              throw new Error(body.error.message)
            }
            const err = new Error(body.error.message)
            err.userError = true
            return bail(err)
          }

          if (body.error && body.error.message) {
            const err = new Error(body.error.message)
            err.userError = true
            return bail(err)
          }
          throw new Error(
            `Error occurred while scaling. Please try again later`
          )
        }

        return body
      },
      {
        retries: 300,
        maxTimeout: ms('5s'),
        factor: 1.1
      }
    )
  }

  async unfreeze(depl) {
    return this.retry(async bail => {
      const res = await fetch(`https://${depl.url}`)

      if ([500, 502, 503].includes(res.status)) {
        const err = new Error('Unfreeze failed. Try again later.')
        bail(err)
      }
    })
  }

  async getPlanMax() {
    return 10
  }
}

function toRelative(path, base) {
  const fullBase = base.endsWith(SEP) ? base : base + SEP
  let relative = path.substr(fullBase.length)

  if (relative.startsWith(SEP)) {
    relative = relative.substr(1)
  }

  return relative.replace(/\\/g, '/')
}

function hasNpmStart(pkg) {
  return pkg.scripts && (pkg.scripts.start || pkg.scripts['now-start'])
}

function hasFile(base, files, name) {
  const relative = files.map(file => toRelative(file, base))
  return relative.indexOf(name) !== -1
}

async function readAuthToken(path, name = '.npmrc') {
  try {
    const contents = await readFile(resolvePath(path, name), 'utf8')
    const npmrc = parseIni(contents)
    return npmrc['//registry.npmjs.org/:_authToken']
  } catch (err) {
    // Do nothing
  }
}
