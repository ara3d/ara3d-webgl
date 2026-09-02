// Content types for the files the examples serve. Anything unlisted is sent as
// a binary blob, which is what the model formats want anyway.

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.glb': 'model/gltf-binary'
}

const DEFAULT_MIME_TYPE = 'application/octet-stream'

/** Content type for a file path, by extension. */
function mimeTypeOf (filePath) {
  const dot = filePath.lastIndexOf('.')
  return MIME_TYPES[filePath.slice(dot).toLowerCase()] ?? DEFAULT_MIME_TYPE
}

module.exports = { MIME_TYPES, DEFAULT_MIME_TYPE, mimeTypeOf }
