/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { Vim } from './vim'
import { SubMesh } from './subMesh'

/**
 * Wrapper around THREE.Mesh
 * Keeps track of what VIM instances are part of this mesh.
 * Is either merged on instanced.
 */
export class Mesh {
  mesh: THREE.Mesh
  vim: Vim | undefined
  merged: boolean
  instances: number[]
  subMeshes: number[]
  instanceBoxes: THREE.Box3[]
  ignoreSceneMaterial: boolean
  boundingBox: THREE.Box3
  private _material: THREE.Material | THREE.Material[]

  private constructor (
    mesh: THREE.Mesh,
    instance: number[],
    boxes: THREE.Box3[]
  ) {
    this.mesh = mesh
    this.mesh.userData.vim = this
    this.instances = instance
    this.instanceBoxes = boxes
    this.boundingBox = this.unionAllBox(boxes)
  }

  static createMerged (
    mesh: THREE.Mesh,
    instances: number[],
    boxes: THREE.Box3[],
    submeshes: number[]
  ) {
    const result = new Mesh(mesh, instances, boxes)
    result.merged = true
    result.subMeshes = submeshes
    return result
  }

  static createInstanced (
    mesh: THREE.Mesh,
    instances: number[],
    boxes: THREE.Box3[]
  ) {
    const result = new Mesh(mesh, instances, boxes)
    result.merged = false
    return result
  }

  /**
   * Overrides mesh material, set to undefine to restore initial material.
   */
  setMaterial (value: THREE.Material) {
    if (this._material === value) return
    if (this.ignoreSceneMaterial) return

    if (value) {
      if (!this._material) {
        this._material = this.mesh.material
      }
      this.mesh.material = value
    } else {
      if (this._material) {
        this.mesh.material = this._material
        this._material = undefined
      }
    }
  }

  /**
   * Returns submesh for given index.
   */
  getSubMesh (index: number) {
    return new SubMesh(this, index)
  }

  /**
   * Returns submesh corresponding to given face on a merged mesh.
   */
  getSubmeshFromFace (faceIndex: number) {
    if (!this.merged) {
      throw new Error('Can only be called when mesh.merged = true')
    }
    const index = this.binarySearch(this.subMeshes, faceIndex * 3)
    return new SubMesh(this, index)
  }

  /**
   *
   * @returns Returns all submeshes
   */
  getSubMeshes () {
    return this.instances.map((s, i) => new SubMesh(this, i))
  }

  private binarySearch (array: number[], element: number) {
    let m = 0
    let n = array.length - 1
    while (m <= n) {
      const k = (n + m) >> 1
      const cmp = element - array[k]
      if (cmp > 0) {
        m = k + 1
      } else if (cmp < 0) {
        n = k - 1
      } else {
        return k
      }
    }
    return m - 1
  }

  private unionAllBox (boxes: THREE.Box3[]) {
    const box = boxes[0].clone()
    for (let i = 1; i < boxes.length; i++) {
      box.union(boxes[i])
    }
    return box
  }
}

