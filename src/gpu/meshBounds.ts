import { BimGeometry } from '../loader/bimGeometry'

/** Local space bounding sphere of every mesh: center xyz then radius, in model units. */
export function computeMeshSpheres (bg: BimGeometry, vertexScale: number): Float32Array {
  const { VertexX, VertexY, VertexZ, MeshVertexOffset } = bg
  const meshCount = MeshVertexOffset.length
  const vertexCount = VertexX.length
  const spheres = new Float32Array(meshCount * 4)

  for (let m = 0; m < meshCount; m++) {
    const start = MeshVertexOffset[m]
    const end = m + 1 < meshCount ? MeshVertexOffset[m + 1] : vertexCount
    if (end <= start) continue

    let minX = Infinity; let minY = Infinity; let minZ = Infinity
    let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity
    for (let v = start; v < end; v++) {
      const x = VertexX[v]; const y = VertexY[v]; const z = VertexZ[v]
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (z < minZ) minZ = z
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
      if (z > maxZ) maxZ = z
    }

    const cx = (minX + maxX) * 0.5 * vertexScale
    const cy = (minY + maxY) * 0.5 * vertexScale
    const cz = (minZ + maxZ) * 0.5 * vertexScale
    const hx = (maxX - minX) * 0.5 * vertexScale
    const hy = (maxY - minY) * 0.5 * vertexScale
    const hz = (maxZ - minZ) * 0.5 * vertexScale

    spheres[m * 4 + 0] = cx
    spheres[m * 4 + 1] = cy
    spheres[m * 4 + 2] = cz
    spheres[m * 4 + 3] = Math.sqrt(hx * hx + hy * hy + hz * hz)
  }

  return spheres
}
