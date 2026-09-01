import * as THREE from 'three'
import { Camera } from '../viewer/camera/camera'

/**
 * BOS geometry is Z-up while the viewer camera works in the Y-up space
 * Three.js assumes. The WebGL viewer converts by rotating the model root;
 * here the rotation is folded into the matrices handed to the renderer, so
 * geometry, instance transforms and culling all stay in model space.
 */
const Z_UP_TO_Y_UP = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
const Y_UP_TO_Z_UP = new THREE.Matrix4().makeRotationX(Math.PI / 2)

/**
 * Maps clip z to w - z, so the near plane renders at depth 1 and the far
 * plane at 0. With a float depth buffer and a 'greater' depth test this
 * spreads depth precision almost evenly over the whole range, where the
 * standard mapping crowds it against the near plane and z-fights at a
 * distance. The renderer and the cull pass both consume the reversed matrix,
 * so their depth comparisons stay consistent.
 */
const REVERSED_Z = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, -1, 1,
  0, 0, 0, 1)

/** Expresses a Z-up model space box in the camera's Y-up space. */
export const toCameraSpace = (box: THREE.Box3) =>
  box.clone().applyMatrix4(Z_UP_TO_Y_UP)

/** Switches both projections to the [0,1] depth range WebGPU expects. */
export function useWebGpuProjection (camera: Camera) {
  const cameras = [camera.camPerspective.camera, camera.camOrthographic.camera]
  for (const c of cameras) {
    c.coordinateSystem = THREE.WebGPUCoordinateSystem
    c.updateProjectionMatrix()
  }
}

/** View-projection mapping Z-up model space to reversed-Z clip space. */
export function modelViewProjection (
  camera: Camera,
  out = new THREE.Matrix4()
) {
  const three = camera.three
  three.updateMatrixWorld(true)
  return out
    .multiplyMatrices(three.projectionMatrix, three.matrixWorldInverse)
    .multiply(Z_UP_TO_Y_UP)
    .premultiply(REVERSED_Z)
}

/** Camera position in Z-up model space. */
export const modelEye = (camera: Camera, out = new THREE.Vector3()) =>
  out.copy(camera.position).applyMatrix4(Y_UP_TO_Z_UP)
