// A minimal read-only file server on localhost. The examples are built with a
// '/ara3d-webgl/' base and fetch models by absolute path, so they need a real
// http origin: over file:// both the module imports and the model fetches fail.

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { mimeTypeOf } = require('./mimeTypes')

/** Maps a request path to a file inside root, or undefined if it escapes root. */
function resolveRequestPath (root, base, requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0])
  if (!decoded.startsWith(base)) return undefined
  const relative = decoded.slice(base.length) || 'index.html'
  const resolved = path.resolve(root, relative)
  const inside = resolved === root || resolved.startsWith(root + path.sep)
  return inside ? resolved : undefined
}

function send (response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(message)
}

function sendFile (response, filePath) {
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) return send(response, 404, 'Not found: ' + filePath)
    response.writeHead(200, {
      'Content-Type': mimeTypeOf(filePath),
      'Content-Length': stats.size
    })
    fs.createReadStream(filePath).pipe(response)
  })
}

/**
 * Serves `root` under `base` on a free localhost port.
 * Resolves to the origin plus a close function.
 */
function startStaticServer (root, base) {
  const absoluteRoot = path.resolve(root)
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return send(response, 405, 'Only GET is supported.')
    }
    const filePath = resolveRequestPath(absoluteRoot, base, request.url)
    if (!filePath) return send(response, 404, 'Outside the served directory.')
    sendFile(response, filePath)
  })

  return new Promise((resolve, reject) => {
    server.on('error', reject)
    // Port 0 asks the OS for a free port, so two copies never collide.
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => new Promise((done) => server.close(done))
      })
    })
  })
}

module.exports = { resolveRequestPath, startStaticServer }
