// Works out what the window should load. Defaults to the checked-in build in
// docs/; --url points at a running dev server instead.

const path = require('node:path')
const fs = require('node:fs')

const REPO_ROOT = path.resolve(__dirname, '..')

const DEFAULTS = {
  dir: path.join(REPO_ROOT, 'docs'),
  base: '/ara3d-webgl/',
  page: 'example-webgpu-multidraw.html'
}

/** Reads a `--name=value` argument. */
function flag (argv, name) {
  const prefix = `--${name}=`
  const hit = argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : undefined
}

/**
 * The load target: either a `url` to open directly, or a `dir` to serve.
 * Environment variables are the fallback so packaged builds can be configured
 * without arguments.
 */
function resolveTarget (argv = process.argv, env = process.env) {
  return {
    url: flag(argv, 'url') ?? env.ARA3D_URL,
    dir: path.resolve(flag(argv, 'dir') ?? env.ARA3D_DIR ?? DEFAULTS.dir),
    base: flag(argv, 'base') ?? env.ARA3D_BASE ?? DEFAULTS.base,
    page: flag(argv, 'page') ?? env.ARA3D_PAGE ?? DEFAULTS.page,
    modelDirs: modelDirs(argv, env),
    devtools: argv.includes('--devtools')
  }
}

/**
 * Directories scanned for the Sample Models menu. The served build and the
 * examples' own folder, where the large `.bfast` render models live.
 */
function modelDirs (argv, env) {
  const given = flag(argv, 'models') ?? env.ARA3D_MODELS
  if (given) return directoryList(given)
  const dir = path.resolve(flag(argv, 'dir') ?? env.ARA3D_DIR ?? DEFAULTS.dir)
  return [dir, path.join(REPO_ROOT, 'examples', 'public')]
}

/** Splits a PATH-style list of directories. */
function directoryList (value) {
  return value.split(path.delimiter).map((d) => d.trim()).filter(Boolean).map((d) => path.resolve(d))
}

/** Joins an origin, base and page into the URL to load. */
function pageUrl (origin, base, page) {
  return origin.replace(/\/$/, '') + base + page
}

/**
 * A url that already names a page is used as given; anything else is treated as
 * an origin and the page is appended.
 */
function urlForTarget (target, origin) {
  if (target.url) {
    return target.url.endsWith('.html') ? target.url : pageUrl(target.url, target.base, target.page)
  }
  return pageUrl(origin, target.base, target.page)
}

/** Throws with a fixable message when the directory to serve has no build in it. */
function checkServedDir (target) {
  if (fs.existsSync(path.join(target.dir, target.page))) return
  throw new Error(
    `${path.join(target.dir, target.page)} not found.\n` +
    'Run "npm run build:docs" first, or pass --url=http://localhost:5173 to use "npm run dev".')
}

module.exports = { DEFAULTS, resolveTarget, urlForTarget, checkServedDir }
