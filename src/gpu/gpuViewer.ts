import * as THREE from 'three'
import { GpuContext, requestGpuContext } from './gpuDevice'
import { GpuRenderer } from './gpuRenderer'
import { OrbitCamera } from './orbitCamera'
import { attachOrbitInput } from './orbitInput'
import { GpuScene, instanceCount } from './gpuScene'

/** What the viewer reports once per frame. */
export type FrameStats = {
    fps: number;
    /** Milliseconds spent inside the render call on the CPU. */
    cpuMs: number;
    drawCommands: number;
    triangles: number;
    multiDraw: boolean;
}

/** Ties a canvas, an orbit camera and the indirect renderer into a render loop. */
export class GpuViewer {
  readonly renderer: GpuRenderer
  readonly camera = new OrbitCamera()
  onFrame: ((stats: FrameStats) => void) | undefined

  private readonly detachInput: () => void
  private running = false
  private frames = 0
  private frameStart = 0
  private cpuMs = 0
  private triangles = 0

  private constructor (canvas: HTMLCanvasElement, ctx: GpuContext) {
    this.renderer = new GpuRenderer(canvas, ctx)
    this.detachInput = attachOrbitInput(canvas, this.camera)
  }

  static async create (canvas: HTMLCanvasElement): Promise<GpuViewer> {
    return new GpuViewer(canvas, await requestGpuContext())
  }

  get context (): GpuContext { return this.renderer.ctx }

  setScene (scene: GpuScene) {
    this.renderer.setScene(scene)
    this.triangles = scene.triangleCount
    this.camera.frame(
      new THREE.Vector3().fromArray(scene.boundsMin),
      new THREE.Vector3().fromArray(scene.boundsMax))
    console.log(`Scene has ${instanceCount(scene)} instances`)
  }

  start () {
    if (this.running) return
    this.running = true
    this.frameStart = performance.now()
    requestAnimationFrame(this.loop)
  }

  stop () { this.running = false }

  dispose () {
    this.stop()
    this.detachInput()
    this.renderer.dispose()
  }

  private readonly loop = () => {
    if (!this.running) return

    this.camera.setAspect(this.renderer.aspect || 1)
    const t0 = performance.now()
    this.renderer.render(this.camera.viewProjection, this.camera.eye)
    this.cpuMs += performance.now() - t0
    this.frames++

    const elapsed = performance.now() - this.frameStart
    if (elapsed > 500 && this.onFrame) {
      this.onFrame({
        fps: (this.frames * 1000) / elapsed,
        cpuMs: this.cpuMs / this.frames,
        drawCommands: this.renderer.drawCount,
        triangles: this.triangles,
        multiDraw: this.renderer.useMultiDraw && this.context.multiDraw
      })
      this.frames = 0
      this.cpuMs = 0
      this.frameStart = performance.now()
    }

    requestAnimationFrame(this.loop)
  }
}
