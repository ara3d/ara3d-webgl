// A minimal read-only file server on localhost. The examples are built with a
// '/ara3d-webgl/' base and fetch models by absolute path, so they need a real
// http origin: over file:// both the module imports and the model fetches fail.

const http = require('node:http')
const fs = require('node:fs')
const { mimeTypeOf } = require('./mimeTypes')

function send (response, status, message) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  response.end(message)
}

function sendFile (request, response, filePath) {
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) return send(response, 404, 'Not found: ' + filePath)
    response.writeHead(200, {
      'Content-Type': mimeTypeOf(filePath),
      'Content-Length': stats.size,
      // The page may be served by a dev server on another port, which makes
      // model requests cross-origin. Only listed files are reachable anyway.
      'Access-Control-Allow-Origin': '*'
    })
    if (request.method === 'HEAD') return response.end()
    fs.createReadStream(filePath).pipe(response)
  })
}

/** The first route that recognises the request path, with the file it resolves to. */
function resolveRoute (routes, requestPath) {
  for (const route of routes) {
    const filePath = route.resolve(requestPath)
    if (filePath) return filePath
  }
  return undefined
}

/**
 * Serves the given routes on a free localhost port.
 * Resolves to the origin plus a close function.
 */
function startStaticServer (routes) {
  const server = http.createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return send(response, 405, 'Only GET is supported.')
    }
    const filePath = resolveRoute(routes, request.url)
    if (!filePath) return send(response, 404, 'No route for ' + request.url)
    sendFile(request, response, filePath)
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

module.exports = { resolveRoute, startStaticServer }
