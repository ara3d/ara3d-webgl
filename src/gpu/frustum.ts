import * as THREE from 'three'

const frustum = new THREE.Frustum()
const matrix = new THREE.Matrix4()

/**
 * Writes the six normalized frustum planes of a view-projection matrix into
 * `out` as xyz normal followed by the plane constant. A point is inside when
 * `dot(normal, p) + constant >= 0`.
 */
export function writeFrustumPlanes (viewProj: THREE.Matrix4, out: Float32Array): Float32Array {
  matrix.copy(viewProj)
  frustum.setFromProjectionMatrix(matrix, THREE.WebGPUCoordinateSystem)
  for (let i = 0; i < 6; i++) {
    const plane = frustum.planes[i]
    out[i * 4 + 0] = plane.normal.x
    out[i * 4 + 1] = plane.normal.y
    out[i * 4 + 2] = plane.normal.z
    out[i * 4 + 3] = plane.constant
  }
  return out
}
