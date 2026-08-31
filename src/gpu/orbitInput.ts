import { OrbitCamera } from './orbitCamera'

/** Connects mouse and touch events on a canvas to an orbit camera. Returns a detach function. */
export function attachOrbitInput (canvas: HTMLCanvasElement, camera: OrbitCamera): () => void {
  let button = -1
  let lastX = 0
  let lastY = 0

  const down = (e: PointerEvent) => {
    button = e.button
    lastX = e.clientX
    lastY = e.clientY
    canvas.setPointerCapture(e.pointerId)
  }

  const move = (e: PointerEvent) => {
    if (button < 0) return
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    if (button === 0) camera.orbit(dx * 0.005, dy * 0.005)
    else camera.pan(dx, dy)
  }

  const up = (e: PointerEvent) => {
    button = -1
    canvas.releasePointerCapture(e.pointerId)
  }

  const wheel = (e: WheelEvent) => {
    e.preventDefault()
    camera.zoom(e.deltaY)
  }

  const menu = (e: Event) => e.preventDefault()

  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)
  canvas.addEventListener('wheel', wheel, { passive: false })
  canvas.addEventListener('contextmenu', menu)

  return () => {
    canvas.removeEventListener('pointerdown', down)
    canvas.removeEventListener('pointermove', move)
    canvas.removeEventListener('pointerup', up)
    canvas.removeEventListener('pointercancel', up)
    canvas.removeEventListener('wheel', wheel)
    canvas.removeEventListener('contextmenu', menu)
  }
}
