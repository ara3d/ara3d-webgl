import * as THREE from 'three'

/** Orbit camera for Z-up BIM models. Left drag orbits, right drag pans, wheel zooms. */
export class OrbitCamera {
  readonly camera = new THREE.PerspectiveCamera(50, 1, 0.05, 10_000)
  target = new THREE.Vector3()
  distance = 10
  azimuth = Math.PI * 0.25
  elevation = Math.PI * 0.2

  private readonly viewProj = new THREE.Matrix4()

  constructor () {
    this.camera.up.set(0, 0, 1)
    this.camera.coordinateSystem = THREE.WebGPUCoordinateSystem
  }

  /** Places the camera so the whole box is in view. */
  frame (min: THREE.Vector3, max: THREE.Vector3) {
    this.target.addVectors(min, max).multiplyScalar(0.5)
    const radius = Math.max(min.distanceTo(max) * 0.5, 1e-3)
    this.distance = radius / Math.tan((this.camera.fov * Math.PI) / 360)
    this.camera.near = Math.max(this.distance / 5000, 0.01)
    this.camera.far = this.distance * 20
    this.update()
  }

  setAspect (aspect: number) {
    this.camera.aspect = aspect
    this.update()
  }

  orbit (dx: number, dy: number) {
    const limit = Math.PI / 2 - 0.01
    this.azimuth -= dx
    this.elevation = clamp(this.elevation + dy, -limit, limit)
    this.update()
  }

  pan (dx: number, dy: number) {
    const scale = this.distance * 0.001
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1)
    this.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale)
    this.update()
  }

  zoom (delta: number) {
    this.distance = clamp(this.distance * Math.exp(delta * 0.001), 0.01, 1e6)
    this.update()
  }

  update () {
    const cosE = Math.cos(this.elevation)
    this.camera.position.set(
      this.target.x + this.distance * cosE * Math.cos(this.azimuth),
      this.target.y + this.distance * cosE * Math.sin(this.azimuth),
      this.target.z + this.distance * Math.sin(this.elevation)
    )
    this.camera.lookAt(this.target)
    this.camera.updateMatrixWorld(true)
    this.camera.updateProjectionMatrix()
    this.viewProj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse)
  }

  get viewProjection (): THREE.Matrix4 { return this.viewProj }
  get eye (): THREE.Vector3 { return this.camera.position }
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)
