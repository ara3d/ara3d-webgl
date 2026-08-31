import * as THREE from 'three'
import { Camera } from '../viewer/camera/camera'
import { Input } from '../viewer/inputs/input'
import { InputHost } from '../viewer/inputs/inputHost'
import { PartialSettings, Settings, getSettings } from '../viewer/viewerSettings'
import { CanvasViewport } from './canvasViewport'

/**
 * The viewer camera together with its mouse, keyboard and touch controls,
 * packaged as a component that needs nothing but a canvas. A renderer drives
 * it by calling update() once per frame and reading `camera.three`.
 */
export class CameraControls implements InputHost {
  readonly camera: Camera
  readonly viewport: CanvasViewport
  readonly settings: Settings
  readonly inputs: Input

  /** Called when a control asks for a redraw. Continuous renderers ignore it. */
  onRequestRender: (() => void) | undefined

  constructor (canvas: HTMLCanvasElement, options?: PartialSettings) {
    this.settings = getSettings(options)
    this.viewport = new CanvasViewport(canvas)
    this.camera = new Camera(this.viewport, this.settings)
    this.inputs = new Input(this)
    this.inputs.registerAll()
  }

  requestRender () {
    this.onRequestRender?.()
  }

  /** Advances velocity based movement. Returns true when the camera moved. */
  update (deltaTime: number) {
    return this.camera.update(deltaTime)
  }

  /**
   * Points the camera at the box, and makes it the target of the frame and
   * home keys. Looks along the configured default forward unless given one.
   */
  frame (bounds: THREE.Box3, forward = this.camera.defaultForward) {
    this.camera.sceneBounds = bounds.clone()
    this.camera.do().frame(bounds, forward)
    this.camera.save()
  }

  /** Sets the near and far clipping distances of both projections. */
  setClipPlanes (near: number, far: number) {
    const perspective = this.camera.camPerspective.camera
    perspective.near = near
    perspective.far = far
    perspective.updateProjectionMatrix()

    const orthographic = this.camera.camOrthographic.camera
    orthographic.near = -far
    orthographic.far = far
    orthographic.updateProjectionMatrix()
  }

  dispose () {
    this.inputs.unregisterAll()
  }
}
