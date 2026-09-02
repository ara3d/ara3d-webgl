// Prints what WebGPU offers under the app's switches, then exits. Run it to
// confirm the multi-draw extension is really on before blaming the renderer.

const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const { applyGpuSwitches } = require('./gpuSwitches')

applyGpuSwitches(app)

const QUERY = `(async () => {
  if (!navigator.gpu) return { error: 'navigator.gpu is missing' }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) return { error: 'no adapter' }
  const info = adapter.info ?? {}
  return {
    adapter: [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' '),
    features: [...adapter.features].sort()
  }
})()`

const REQUIRED = ['indirect-first-instance', 'chromium-experimental-multi-draw-indirect']

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadFile(path.join(__dirname, 'features.html'))
  const result = await win.webContents.executeJavaScript(QUERY)
  console.log(JSON.stringify(result, null, 2))
  const missing = REQUIRED.filter((f) => !result.features?.includes(f))
  if (missing.length) console.log('MISSING:', missing.join(', '))
  else console.log('OK: multi-draw indirect is available.')
  app.exit(missing.length || result.error ? 1 : 0)
})
