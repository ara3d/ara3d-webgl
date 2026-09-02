// The application menu. Its only job is choosing which model the example page
// loads, which it does by reloading the page with a `?model=` URL — the same
// entry point the examples already use in a browser.

const { Menu, dialog } = require('electron')
const { MODEL_EXTENSIONS, formatSize } = require('./modelFiles')

const isMac = () => process.platform === 'darwin'

/** Shows the open dialog and returns the chosen path, or undefined if cancelled. */
async function chooseModelFile (win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open model',
    properties: ['openFile'],
    filters: [
      { name: 'Models', extensions: MODEL_EXTENSIONS.map((e) => e.slice(1)) },
      { name: 'All files', extensions: ['*'] }
    ]
  })
  return canceled ? undefined : filePaths[0]
}

function modelItems (models, openModel) {
  if (models.length === 0) return [{ label: 'None found', enabled: false }]
  return models.map((model) => ({
    label: `${model.name}  (${formatSize(model.size)})`,
    click: () => openModel(model.path)
  }))
}

function template ({ win, models, openModel }) {
  return [
    ...(isMac() ? [{ role: 'appMenu' }] : []),
    {
      label: '&File',
      submenu: [
        {
          label: 'Open Model...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const filePath = await chooseModelFile(win)
            if (filePath) openModel(filePath)
          }
        },
        { type: 'separator' },
        { label: 'Sample Models', submenu: modelItems(models, openModel) },
        { type: 'separator' },
        { role: isMac() ? 'close' : 'quit' }
      ]
    },
    { role: 'viewMenu' },
    ...(isMac() ? [{ role: 'windowMenu' }] : [])
  ]
}

function installMenu (options) {
  Menu.setApplicationMenu(Menu.buildFromTemplate(template(options)))
}

module.exports = { chooseModelFile, modelItems, template, installMenu }
