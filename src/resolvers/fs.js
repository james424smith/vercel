const { exists } = require('fs-extra-promise')
const { resolve } = require('path')

const fsResolver = async (param, { cwd = process.cwd() } = {}) => {
  const resolved = resolve(cwd, param)
  if (await exists(resolved)) {
    return resolved
  } else {
    return null
  }
}

module.exports = fsResolver
