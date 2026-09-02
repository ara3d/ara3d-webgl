// Chromium command-line switches that turn on the experimental WebGPU features
// the multi-draw examples need. In a normal browser these live behind
// chrome://flags; an Electron app sets them for itself, so users get the fast
// path without touching browser settings.

/** Dawn toggles to request. Dawn is the WebGPU implementation inside Chromium. */
const DAWN_FEATURES = ['multi_draw_indirect']

/** Switches every platform needs. */
const COMMON = [
  ['enable-unsafe-webgpu', ''],
  ['enable-dawn-features', DAWN_FEATURES.join(',')]
]

/**
 * Extra switches per platform. Windows and macOS pick a working backend on
 * their own (D3D12 and Metal); on Linux the Vulkan backend has to be asked for.
 */
const BY_PLATFORM = {
  win32: [],
  darwin: [],
  linux: [['enable-features', 'Vulkan']]
}

/** The [name, value] switch pairs for a platform, with same-named values merged. */
function gpuSwitches (platform = process.platform) {
  const merged = new Map()
  for (const [name, value] of [...COMMON, ...(BY_PLATFORM[platform] ?? [])]) {
    const previous = merged.get(name)
    merged.set(name, previous ? [previous, value].filter(Boolean).join(',') : value)
  }
  return [...merged]
}

/**
 * Applies the switches to an Electron app. Chromium reads them when the GPU
 * process starts, so this must run before the app is ready.
 */
function applyGpuSwitches (app, platform = process.platform) {
  const switches = gpuSwitches(platform)
  for (const [name, value] of switches) {
    if (value) app.commandLine.appendSwitch(name, value)
    else app.commandLine.appendSwitch(name)
  }
  return switches
}

module.exports = { DAWN_FEATURES, gpuSwitches, applyGpuSwitches }
