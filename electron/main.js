// Electron entry point for the WebGPU examples. It exists to set the Chromium
// switches that chrome://flags would otherwise control, then show one window.

const { app, dialog, BrowserWindow } = require('electron')
const fs = require('node:fs')
const { applyGpuSwitches } = require('./gpuSwitches')
const { resolveTarget, urlForTarget, checkServedDir } = require('./appTarget')
const { directoryRoute, openedFilesRoute } = require('./routes')
const { startStaticServer } = require('./staticServer')
const { findModels } = require('./modelFiles')
const { createWindow } = require('./window')
const { installMenu } = require('./menu')

// Before app.whenReady(): Chromium reads these when the GPU process starts.
const switches = applyGpuSwitches(app)

const target = resolveTarget()
const opened = openedFilesRoute('/opened/')
let server

/** The build to serve, unless --url points at a server that already has one. */
function servedRoutes (target) {
  if (target.url) return []
  checkServedDir(target)
  return [directoryRoute(target.base, target.dir)]
}

async function start () {
  server = await startStaticServer([...servedRoutes(target), opened])
  const pageUrl = urlForTarget(target, server.origin)
  console.log('GPU switches:', switches.map(([n, v]) => (v ? `--${n}=${v}` : `--${n}`)).join(' '))
  console.log('Loading:', pageUrl)

  const win = createWindow(pageUrl, target)
  // The examples already take a model URL; opening a file just points that at
  // the local server rather than at a bundled sample.
  const openModel = (filePath) => {
    if (!fs.existsSync(filePath)) {
      return dialog.showErrorBox('Ara 3D WebGPU', 'File not found: ' + filePath)
    }
    win.loadURL(pageUrl + '?model=' + encodeURIComponent(server.origin + opened.add(filePath)))
  }
  installMenu({ win, models: findModels(target.modelDirs), openModel })
}

app.whenReady().then(start).catch((error) => {
  dialog.showErrorBox('Ara 3D WebGPU', String(error.message ?? error))
  app.quit()
})

// macOS keeps the app running with no windows, and reopens one from the dock.
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) start()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => { if (server) server.close() })
