// Electron entry point for the WebGPU examples. It exists to set the Chromium
// switches that chrome://flags would otherwise control, then show one window.

const { app, dialog, BrowserWindow } = require('electron')
const { applyGpuSwitches } = require('./gpuSwitches')
const { resolveTarget, urlForTarget, checkServedDir } = require('./appTarget')
const { startStaticServer } = require('./staticServer')
const { createWindow } = require('./window')

// Before app.whenReady(): Chromium reads these when the GPU process starts.
const switches = applyGpuSwitches(app)

const target = resolveTarget()
let server

async function originFor (target) {
  if (target.url) return undefined
  checkServedDir(target)
  server = await startStaticServer(target.dir, target.base)
  return server.origin
}

async function start () {
  const url = urlForTarget(target, await originFor(target))
  console.log('GPU switches:', switches.map(([n, v]) => (v ? `--${n}=${v}` : `--${n}`)).join(' '))
  console.log('Loading:', url)
  createWindow(url, target)
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
