// The single demo window. Nothing in the page needs Node, so the renderer stays
// sandboxed with context isolation on.

const { BrowserWindow } = require('electron')

function createWindow (url, { devtools = false } = {}) {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    backgroundColor: '#1e1e1e',
    title: 'Ara 3D WebGPU',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // A viewer should keep drawing when another window covers it; Chromium
      // would otherwise throttle animation frames down to a crawl.
      backgroundThrottling: false
    }
  })
  if (devtools) win.webContents.openDevTools({ mode: 'detach' })
  win.loadURL(url)
  return win
}

module.exports = { createWindow }
