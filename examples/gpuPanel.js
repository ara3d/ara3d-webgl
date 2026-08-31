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
.gpu-panel h2 { font-size: 13px; margin: 0 0 8px; color: #9fd0ff; font-weight: 600; }
.gpu-row { display: flex; justify-content: space-between; gap: 16px; }
.gpu-row span:last-child { color: #ffd479; }
.gpu-note { margin-top: 8px; color: #9aa4b2; }
.gpu-note.bad { color: #ff8f8f; }
.gpu-toggle { margin-top: 10px; display: flex; align-items: center; gap: 6px; color: #cbd4e1; }
`

const ROWS = [
  ['adapter', 'Adapter'],
  ['status', 'Multi-draw'],
  ['draws', 'Draw commands'],
  ['tris', 'Triangles'],
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
  panel.className = 'gpu-panel'
  panel.innerHTML =
    '<h2>BIM Open Schema &mdash; WebGPU multiDrawIndexedIndirect</h2>' +
    ROWS.map(([id, label]) =>
      `<div class="gpu-row"><span>${label}</span><span id="gpu-${id}">-</span></div>`).join('') +
    '<div class="gpu-note" id="gpu-note">Starting up...</div>' +
    '<label class="gpu-toggle"><input type="checkbox" id="gpu-multi" checked disabled>' +
    'Use multiDrawIndexedIndirect</label>'
  page.appendChild(panel)

  document.body.appendChild(page)

  const cell = (id) => document.getElementById('gpu-' + id)
  const note = cell('note')
  const toggle = cell('multi')

  return {
    canvas,
    toggle,
    set (id, value) { cell(id).textContent = value },
    setNote (text, bad = false) {
      note.textContent = text
      note.className = bad ? 'gpu-note bad' : 'gpu-note'
    }
  }
}

const fmt = (n) => n.toLocaleString('en-US')

/** Writes one frame of statistics into the panel. */
export function showStats (panel, stats) {
  panel.set('fps', stats.fps.toFixed(1))
  panel.set('cpu', stats.cpuMs.toFixed(2))
  panel.set('draws', fmt(stats.drawCommands))
  panel.set('tris', fmt(Math.round(stats.triangles)))
}

export { fmt }
