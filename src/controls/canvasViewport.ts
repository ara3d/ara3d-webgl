import * as THREE from 'three'
import { InputSurface } from '../viewer/inputs/inputHost'
import { CameraViewport } from '../viewer/camera/cameraViewport'

/** Reports the size of an existing canvas to the camera and input handlers. */
export class CanvasViewport implements InputSurface, CameraViewport {
  readonly canvas: HTMLCanvasElement

  constructor (canvas: HTMLCanvasElement) {
    this.canvas = canvas
  }

  getSize () {
    return new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight)
  }

  getAspectRatio () {
    const size = this.getSize()
    return size.y === 0 ? 1 : size.x / size.y
  }
}
