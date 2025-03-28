import { Mesh } from './mesh'

export class SubMesh {
  mesh: Mesh
  index: number

  constructor (mesh: Mesh, index: number) {
    this.mesh = mesh
    this.index = index
  }

  /**
   * Returns parent three mesh.
   */
  get three () {
    return this.mesh.mesh
  }

  /**
   * True if parent mesh is merged.
   */
  get merged () {
    return this.mesh.merged
  }

  /**
   * Returns vim instance associated with this submesh.
   */
  get instance() {
    return this.mesh.instances[this.index]
  }

  /**
   * Returns bounding box for this submesh.
   */
  get boundingBox() {
    return this.mesh.instanceBoxes[this.index]
  }

  /**
   * Returns starting position in parent mesh for merged mesh.
   */
  get meshStart() {
    return this.mesh.subMeshes[this.index]
  }

  /**
   * Returns ending position in parent mesh for merged mesh.
   */
  get meshEnd() {
    return this.index + 1 < this.mesh.subMeshes.length
      ? this.mesh.subMeshes[this.index + 1]
      : this.three.geometry.index!.count
  }

  /**
   * Returns vim object for this submesh.
   */
  get object() {
    return this.mesh.vim.getObjectFromInstance(this.instance)
  }
}