// The two ways the server turns a request path into a file: a directory served
// whole, and a registry of individually opened files.

const path = require('node:path')

/** Strips a prefix from a request path, or undefined when it does not match. */
function relativeTo (prefix, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0])
  return decoded.startsWith(prefix) ? decoded.slice(prefix.length) : undefined
}

/** Resolves inside dir, refusing anything that escapes it. */
function resolveInside (dir, relative) {
  const resolved = path.resolve(dir, relative || 'index.html')
  const inside = resolved === dir || resolved.startsWith(dir + path.sep)
  return inside ? resolved : undefined
}

/** Serves everything under a directory. */
function directoryRoute (prefix, dir) {
  const root = path.resolve(dir)
  return {
    prefix,
    resolve: (requestPath) => {
      const relative = relativeTo(prefix, requestPath)
      return relative === undefined ? undefined : resolveInside(root, relative)
    }
  }
}

/**
 * Serves files chosen elsewhere in the app, one at a time. Only paths handed to
 * `add` are reachable, so opening a model does not expose its whole folder.
 */
function openedFilesRoute (prefix) {
  const byId = new Map()
  let next = 0
  return {
    prefix,
    /** Registers a file and returns the path to request it at. */
    add: (filePath) => {
      const id = String(next++)
      byId.set(id, path.resolve(filePath))
      return prefix + id + '/' + encodeURIComponent(path.basename(filePath))
    },
    resolve: (requestPath) => {
      const relative = relativeTo(prefix, requestPath)
      return relative === undefined ? undefined : byId.get(relative.split('/')[0])
    }
  }
}

module.exports = { relativeTo, resolveInside, directoryRoute, openedFilesRoute }
