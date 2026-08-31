import * as THREE from 'three'

/**
 * How many pixels one world unit spans at a view depth of one unit, in a
 * viewport `height` pixels tall. The projection's vertical scale is the length
 * of the second row of the view-projection matrix, because the view half of
 * that product is a rigid transform and so does not change lengths.
 */
export function pixelsPerUnitAtUnitDepth (viewProj: THREE.Matrix4, height: number): number {
  const e = viewProj.elements
  return 0.5 * height * Math.hypot(e[1], e[5], e[9])
}

/**
 * Writes the plane that measures view depth, so that `dot(xyz, p) + w` is the
 * distance from the eye to `p` along the view direction. It is the fourth row
 * of the view-projection matrix, which a perspective projection fills with the
 * negated view space z, and it is already normalized.
 */
export function writeDepthPlane (
  viewProj: THREE.Matrix4, out: Float32Array, offset: number
): Float32Array {
  const e = viewProj.elements
  out[offset + 0] = e[3]
  out[offset + 1] = e[7]
  out[offset + 2] = e[11]
  out[offset + 3] = e[15]
  return out
}
