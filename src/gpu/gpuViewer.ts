import * as THREE from 'three'
import { GpuContext, requestGpuContext } from './gpuDevice'
import { GpuRenderer } from './gpuRenderer'
import { CameraControls } from '../controls/cameraControls'
import {
  modelEye,
  modelViewProjection,
  toCameraSpace,
  useWebGpuProjection
} from './gpuCameraView'
import { GpuScene, instanceCount } from './gpuScene'

/** What the viewer reports once per frame. */
export type FrameStats = {
    fps: number;
    /** Milliseconds spent inside the render call on the CPU. */
    cpuMs: number;
    drawCommands: number;
    /** Commands actually submitted, which is lower than drawCommands when culling. */
    drawnCommands: number;
    triangles: number;
    multiDraw: boolean;
    culling: boolean;
}

const stallReason = (idleMs: number) =>
  document.hidden
    ? 'paused: page is not visible'
    : `paused: no frames for ${(idleMs / 1000).toFixed(1)}s`

const WATCHDOG_INTERVAL_MS = 1000
const STALL_MS = 2000

/** Ties a canvas, the viewer camera controls and the indirect renderer into a render loop. */
export class GpuViewer {
  readonly renderer: GpuRenderer
  readonly controls: CameraControls
  onFrame: ((stats: FrameStats) => void) | undefined
  /** Called once if rendering stops, with the reason. */
  onStopped: ((reason: string) => void) | undefined
  /** Called when frames stop arriving, and again with undefined when they resume. */
  onStalled: ((reason: string | undefined) => void) | undefined

  private running = false
  private frames = 0
  private frameStart = 0
  private cpuMs = 0
  private triangles = 0
  private lastFrameAt = 0
  private lastUpdateAt = 0
  private stalled = false
  private watchdog: ReturnType<typeof setInterval> | undefined

  private readonly viewProj = new THREE.Matrix4()
  private readonly eye = new THREE.Vector3()

  private constructor (canvas: HTMLCanvasElement, ctx: GpuContext) {
    this.renderer = new GpuRenderer(canvas, ctx)
    this.controls = new CameraControls(canvas)
    useWebGpuProjection(this.controls.camera)
    ctx.lost.then((info) => this.fail(`WebGPU device lost (${info.reason}): ${info.message}`))
  }

  /** The camera the controls drive. */
  get camera () { return this.controls.camera }

  /** Stops the loop and reports why, so a dead device is not a silent freeze. */
  private fail (reason: string) {
    if (!this.running) return
    this.running = false
    console.error(reason)
    this.onStopped?.(reason)
  }

  static async create (canvas: HTMLCanvasElement): Promise<GpuViewer> {
    return new GpuViewer(canvas, await requestGpuContext())
  }

  get context (): GpuContext { return this.renderer.ctx }

  setScene (scene: GpuScene) {
    this.renderer.setScene(scene)
    this.triangles = scene.triangleCount

    const bounds = toCameraSpace(new THREE.Box3(
      new THREE.Vector3().fromArray(scene.boundsMin),
      new THREE.Vector3().fromArray(scene.boundsMax)))
    const radius = Math.max(bounds.getSize(new THREE.Vector3()).length() * 0.5, 1e-3)
    this.controls.setClipPlanes(Math.max(radius / 2000, 1e-3), radius * 50)
    this.controls.frame(bounds)

    console.log(`Scene has ${instanceCount(scene)} instances`)
  }

  start () {
    if (this.running) return
    this.running = true
    this.frameStart = performance.now()
    this.lastFrameAt = performance.now()
    this.lastUpdateAt = performance.now()
    this.watchdog = setInterval(this.checkStalled, WATCHDOG_INTERVAL_MS)
    requestAnimationFrame(this.loop)
  }

  stop () {
    this.running = false
    clearInterval(this.watchdog)
    this.watchdog = undefined
  }

  /**
   * Browsers stop calling requestAnimationFrame while a window or tab is not
   * visible, which leaves the last frame statistics on screen looking live.
   * This reports the gap so a paused viewer is not mistaken for a slow one.
   */
  private readonly checkStalled = () => {
    const idle = performance.now() - this.lastFrameAt
    const stalled = this.running && idle > STALL_MS
    if (stalled === this.stalled) return
    this.stalled = stalled
    this.onStalled?.(stalled ? stallReason(idle) : undefined)
  }

  dispose () {
    this.stop()
    this.controls.dispose()
    this.renderer.dispose()
  }

  private readonly loop = () => {
    if (!this.running) return

    const now = performance.now()
    this.controls.update(Math.min((now - this.lastUpdateAt) / 1000, 0.1))
    this.lastUpdateAt = now

    const t0 = performance.now()
    try {
      this.renderer.render(
        modelViewProjection(this.camera, this.viewProj),
        modelEye(this.camera, this.eye))
    } catch (e) {
      this.fail('Rendering stopped: ' + ((e as Error).message ?? e))
      return
    }
    this.cpuMs += performance.now() - t0
    this.frames++
    this.lastFrameAt = performance.now()

    const elapsed = performance.now() - this.frameStart
    if (elapsed > 500 && this.onFrame) {
      this.onFrame({
        fps: (this.frames * 1000) / elapsed,
        cpuMs: this.cpuMs / this.frames,
        drawCommands: this.renderer.drawCount,
        drawnCommands: this.renderer.drawnCount,
        triangles: this.triangles,
        multiDraw: this.renderer.useMultiDraw && this.context.multiDraw,
        culling: this.renderer.cullingActive
      })
      this.frames = 0
      this.cpuMs = 0
      this.frameStart = performance.now()
    }

    requestAnimationFrame(this.loop)
  }
}
