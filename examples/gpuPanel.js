// Small HUD for the WebGPU multi-draw demo: status line, stats and a toggle.

const STYLE = `
.gpu-page { position: fixed; inset: 0; background: #16181c; }
.gpu-canvas { width: 100%; height: 100%; display: block; touch-action: none; outline: none; }
.gpu-panel {
  position: absolute; top: 12px; left: 12px; padding: 12px 14px;
  font: 12px/1.5 ui-monospace, Consolas, monospace; color: #e8ecf2;
  background: rgba(20, 22, 26, 0.82); border: 1px solid #333a44; border-radius: 6px;
  min-width: 280px; pointer-events: auto;
}
.gpu-panel h2 {
  font-size: 13px; margin: 0; color: #9fd0ff; font-weight: 600;
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
}
.gpu-panel.open h2 { margin-bottom: 8px; }
.gpu-rollup {
  font: inherit; color: #9aa4b2; background: none; border: 1px solid #333a44;
  border-radius: 4px; width: 22px; height: 22px; cursor: pointer; line-height: 1;
}
.gpu-rollup:hover { color: #e8ecf2; border-color: #55606e; }
.gpu-row { display: flex; justify-content: space-between; gap: 16px; }
.gpu-row span:last-child { color: #ffd479; }
.gpu-note { margin-top: 8px; color: #9aa4b2; }
.gpu-note.bad { color: #ff8f8f; }
.gpu-toggle { margin-top: 10px; display: flex; align-items: center; gap: 6px; color: #cbd4e1; }
.gpu-slider { margin-top: 6px; display: flex; align-items: center; gap: 8px; color: #cbd4e1; }
.gpu-slider input { flex: 1; }
.gpu-slider span { color: #ffd479; min-width: 56px; text-align: right; }
.gpu-slider .gpu-slider-label { color: #cbd4e1; min-width: 0; text-align: left; }
`

const MAX_THRESHOLD_PX = 4

/**
 * Maps the slider's 0..1000 position to pixels. The cube keeps the steps fine
 * where the useful values are, which is well under half a pixel.
 */
const sliderToPixels = (position) =>
  Math.round(MAX_THRESHOLD_PX * Math.pow(position / 1000, 3) * 1000) / 1000

const pixelsToSlider = (px) => Math.round(1000 * Math.cbrt(px / MAX_THRESHOLD_PX))

// Movement speed is the camera's exponential speed step: each +1 flies
// 1.25 times faster. The slider covers about 0.1x to 9.3x.
const SPEED_MIN = -10
const SPEED_MAX = 10
const speedMultiplier = (speed) => Math.pow(1.25, speed)

// Mouse sensitivity is a plain multiplier, mapped logarithmically over
// 0.1x to 10x so both halves of the range get fine steps.
const sliderToSensitivity = (position) => Math.pow(10, position / 500 - 1)
const sensitivityToSlider = (value) =>
  Math.round(500 * (Math.log10(value) + 1))

const ROWS = [
  ['adapter', 'Adapter'],
  ['status', 'Multi-draw'],
  ['draws', 'Draw commands'],
  ['drawn', 'Submitted'],
  ['meshtris', 'Mesh triangles'],
  ['tris', 'Triangles (all instances)'],
  ['load', 'Model load'],
  ['fps', 'FPS'],
  ['cpu', 'CPU ms / frame']
]

/** Builds the page chrome and returns the canvas plus setters for the HUD. */
export function createGpuPanel () {
  const style = document.createElement('style')
  style.textContent = STYLE
  document.head.appendChild(style)

  const page = document.createElement('div')
  page.className = 'gpu-page'

  const canvas = document.createElement('canvas')
  canvas.className = 'gpu-canvas'
  canvas.tabIndex = 0
  page.appendChild(canvas)

  const panel = document.createElement('div')
  panel.className = 'gpu-panel open'
  panel.innerHTML =
    '<h2><span>BIM Open Schema &mdash; WebGPU multiDrawIndexedIndirect</span>' +
    '<button class="gpu-rollup" id="gpu-rollup" title="Hide the panel">&#9650;</button></h2>' +
    '<div id="gpu-body">' +
    ROWS.map(([id, label]) =>
      `<div class="gpu-row"><span>${label}</span><span id="gpu-${id}">-</span></div>`).join('') +
    '<div class="gpu-note" id="gpu-note">Starting up...</div>' +
    '<label class="gpu-toggle"><input type="checkbox" id="gpu-multi" checked disabled>' +
    'Use multiDrawIndexedIndirect</label>' +
    '<label class="gpu-toggle"><input type="checkbox" id="gpu-cull" disabled>' +
    'GPU frustum culling</label>' +
    '<label class="gpu-toggle"><input type="checkbox" id="gpu-contrib" disabled>' +
    'GPU contribution culling</label>' +
    '<div class="gpu-slider"><input type="range" id="gpu-contrib-px" ' +
    'min="0" max="1000" step="1" disabled>' +
    '<span id="gpu-contrib-value">-</span></div>' +
    '<label class="gpu-toggle"><input type="checkbox" id="gpu-backface" checked>' +
    'Back-face culling</label>' +
    '<label class="gpu-toggle"><input type="checkbox" id="gpu-sort">' +
    'Sort front to back</label>' +
    '<label class="gpu-toggle"><input type="checkbox" id="gpu-msaa" checked>' +
    'MSAA 4x</label>' +
    '<div class="gpu-slider"><span class="gpu-slider-label">Move speed</span>' +
    `<input type="range" id="gpu-speed" min="${SPEED_MIN}" max="${SPEED_MAX}" step="0.5">` +
    '<span id="gpu-speed-value">-</span></div>' +
    '<div class="gpu-slider"><span class="gpu-slider-label">Mouse</span>' +
    '<input type="range" id="gpu-sens" min="0" max="1000" step="1">' +
    '<span id="gpu-sens-value">-</span></div>' +
    '</div>'
  page.appendChild(panel)

  document.body.appendChild(page)

  const cell = (id) => document.getElementById('gpu-' + id)
  const note = cell('note')
  const body = cell('body')
  const rollup = cell('rollup')
  rollup.addEventListener('click', () => {
    const open = body.style.display !== 'none'
    body.style.display = open ? 'none' : ''
    panel.classList.toggle('open', !open)
    rollup.innerHTML = open ? '&#9660;' : '&#9650;'
    rollup.title = open ? 'Show the panel' : 'Hide the panel'
  })
  const toggle = cell('multi')
  const cullToggle = cell('cull')
  const contribToggle = cell('contrib')
  const backFaceToggle = cell('backface')
  const sortToggle = cell('sort')
  const msaaToggle = cell('msaa')
  const contribSlider = cell('contrib-px')
  const contribValue = cell('contrib-value')
  const speedSlider = cell('speed')
  const speedValue = cell('speed-value')
  const sensSlider = cell('sens')
  const sensValue = cell('sens-value')

  return {
    canvas,
    toggle,
    cullToggle,
    contribToggle,
    backFaceToggle,
    sortToggle,
    msaaToggle,
    contribSlider,
    /** Threshold in pixels currently shown by the slider. */
    contributionPixels () { return sliderToPixels(Number(contribSlider.value)) },
    /** Moves the slider to a threshold in pixels and updates the readout. */
    setContributionPixels (px) {
      contribSlider.value = String(pixelsToSlider(px))
      this.showContributionPixels()
    },
    showContributionPixels () {
      contribValue.textContent = this.contributionPixels().toFixed(2) + ' px'
    },
    speedSlider,
    sensitivitySlider: sensSlider,
    /** Camera speed step currently shown by the move speed slider. */
    moveSpeed () { return Number(speedSlider.value) },
    /** Moves the slider to a camera speed step and updates the readout. */
    setMoveSpeed (speed) {
      speedSlider.value = String(speed)
      this.showMoveSpeed()
    },
    showMoveSpeed () {
      speedValue.textContent = speedMultiplier(this.moveSpeed()).toFixed(2) + 'x'
    },
    /** Mouse sensitivity multiplier currently shown by the slider. */
    mouseSensitivity () { return sliderToSensitivity(Number(sensSlider.value)) },
    /** Moves the slider to a sensitivity multiplier and updates the readout. */
    setMouseSensitivity (value) {
      sensSlider.value = String(sensitivityToSlider(value))
      this.showMouseSensitivity()
    },
    showMouseSensitivity () {
      sensValue.textContent = this.mouseSensitivity().toFixed(2) + 'x'
    },
    set (id, value) { cell(id).textContent = value },
    setNote (text, bad = false) {
      note.textContent = text
      note.className = bad ? 'gpu-note bad' : 'gpu-note'
      note.style.display = text ? '' : 'none'
    }
  }
}

const fmt = (n) => n.toLocaleString('en-US')

/** Writes one frame of statistics into the panel. */
export function showStats (panel, stats) {
  panel.set('fps', stats.fps.toFixed(1))
  panel.set('cpu', stats.cpuMs.toFixed(2))
  panel.set('draws', fmt(stats.drawCommands))
  panel.set('drawn', stats.drawnCommands < stats.drawCommands ? fmt(stats.drawnCommands) : 'all')
  panel.set('meshtris', fmt(Math.round(stats.meshTriangles)))
  panel.set('tris', fmt(Math.round(stats.triangles)))
}

export { fmt }
