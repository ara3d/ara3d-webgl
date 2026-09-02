// Finds the model files the menu offers. The examples keep large `.bfast`
// render models next to the small `.bos` samples, and neither is checked in, so
// the list has to come from whatever is on disk.

const fs = require('node:fs')
const path = require('node:path')

const MODEL_EXTENSIONS = ['.bfast', '.bos']

function isModelFile (name) {
  return MODEL_EXTENSIONS.includes(path.extname(name).toLowerCase())
}

/** Model files directly inside one directory. Missing directories yield none. */
function modelsInDirectory (dir) {
  let names = []
  try {
    names = fs.readdirSync(dir)
  } catch { return [] }
  return names.filter(isModelFile).map((name) => {
    const file = path.join(dir, name)
    return { name, path: file, size: fs.statSync(file).size }
  })
}

/** Models across several directories, deduplicated by name, first directory winning. */
function findModels (dirs) {
  const byName = new Map()
  for (const dir of dirs) {
    for (const model of modelsInDirectory(dir)) {
      if (!byName.has(model.name)) byName.set(model.name, model)
    }
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** A file size for a menu label, in whole units. */
function formatSize (bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++ }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

module.exports = { MODEL_EXTENSIONS, isModelFile, modelsInDirectory, findModels, formatSize }
