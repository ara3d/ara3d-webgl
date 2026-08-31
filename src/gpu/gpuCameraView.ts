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

/** View-projection mapping Z-up model space to clip space. */
export function modelViewProjection (
  camera: Camera,
  out = new THREE.Matrix4()
) {
  const three = camera.three
  three.updateMatrixWorld(true)
  return out
    .multiplyMatrices(three.projectionMatrix, three.matrixWorldInverse)
    .multiply(Z_UP_TO_Y_UP)
}

/** Camera position in Z-up model space. */
export const modelEye = (camera: Camera, out = new THREE.Vector3()) =>
  out.copy(camera.position).applyMatrix4(Y_UP_TO_Z_UP)
