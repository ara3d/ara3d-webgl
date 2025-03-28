/**
 * @module vim-loader
 */

// external
import * as THREE from 'three'
import { Vim } from './vim'
import { SubMesh } from './subMesh'

export class ObjectAttribute<T> {
  value: T
  vertexAttribute: string
  instanceAttribute: string
  private readonly _meshes: SubMesh[] | undefined
  toNumber: (value: T) => number

  constructor (
    value: T,
    vertexAttribute: string,
    instanceAttribute: string,
    meshes: SubMesh[] | undefined,
    toNumber: (value: T) => number
  ) {
    this.value = value
    this.vertexAttribute = vertexAttribute
    this.instanceAttribute = instanceAttribute
    this._meshes = meshes
    this.toNumber = toNumber
  }

  apply (value: T) {
    if (this.value === value) return false
    this.value = value
    if (!this._meshes) return false
    const number = this.toNumber(value)

    for (let m = 0; m < this._meshes.length; m++) {
      const sub = this._meshes[m]
      if (sub.merged) {
        this.applyMerged(sub, number)
      } else {
        this.applyInstanced(sub, number)
      }
    }
    return true
  }

  private applyInstanced (sub: SubMesh, number: number) {
    const mesh = sub.three as THREE.InstancedMesh
    const geometry = mesh.geometry
    let attribute = geometry.getAttribute(
      this.instanceAttribute
    ) as THREE.BufferAttribute

    if (!attribute) {
      const array = new Float32Array(mesh.count)
      attribute = new THREE.InstancedBufferAttribute(array, 1)
      geometry.setAttribute(this.instanceAttribute, attribute)
    }
    attribute.setX(sub.index, number)
    attribute.needsUpdate = true
    attribute.updateRange.offset = 0
    attribute.updateRange.count = -1
  }

  private applyMerged (sub: SubMesh, number: number) {
    const geometry = sub.three.geometry
    const positions = geometry.getAttribute('position')

    let attribute = geometry.getAttribute(
      this.vertexAttribute
    ) as THREE.BufferAttribute

    if (!attribute) {
      const array = new Float32Array(positions.count)
      attribute = new THREE.Float32BufferAttribute(array, 1)
      geometry.setAttribute(this.vertexAttribute, attribute)
    }

    const start = sub.meshStart
    const end = sub.meshEnd
    const indices = sub.three.geometry.index!

    for (let i = start; i < end; i++) {
      const v = indices.getX(i)
      attribute.setX(v, number)
    }
    attribute.needsUpdate = true
    attribute.updateRange.offset = 0
    attribute.updateRange.count = -1
  }
}

export class ColorAttribute {
  _meshes: SubMesh[] | undefined
  value: THREE.Color | undefined
  vim: Vim
  constructor (
    meshes: SubMesh[] | undefined,
    value: THREE.Color | undefined,
    vim: Vim
  ) {
    this._meshes = meshes
    this.value = value
    this.vim = vim
  }

  apply (color: THREE.Color | undefined) {
    if (!this._meshes) return

    for (let m = 0; m < this._meshes.length; m++) {
      const sub = this._meshes[m]
      if (sub.merged) {
        this.applyMergedColor(sub, color)
      } else {
        this.applyInstancedColor(sub, color)
      }
    }
  }

  /**
   * Writes new color to the appropriate section of merged mesh color buffer.
   */
  private applyMergedColor (sub: SubMesh, color: THREE.Color | undefined) {
    if (!color) {
      this.resetMergedColor(sub)
      return
    }

    const start = sub.meshStart
    const end = sub.meshEnd

    const colors = sub.three.geometry.getAttribute(
      'color'
    ) as THREE.BufferAttribute

    const indices = sub.three.geometry.index!
    for (let i = start; i < end; i++) {
      const v = indices.getX(i)
      // alpha is left to its current value
      colors.setXYZ(v, color.r, color.g, color.b)
    }
    colors.needsUpdate = true
    colors.updateRange.offset = 0
    colors.updateRange.count = -1
  }

  /**
   * Repopulates the color buffer of the merged mesh from original g3d data.
   */
  private resetMergedColor (sub: SubMesh) {
    if (!this.vim) return
    const colors = sub.three.geometry.getAttribute(
      'color'
    ) as THREE.BufferAttribute

    const indices = sub.three.geometry.index!
    let mergedIndex = sub.meshStart

    const g3d = this.vim.g3d
    const g3dMesh = g3d.instanceMeshes[sub.instance]
    const subStart = g3d.getMeshSubmeshStart(g3dMesh)
    const subEnd = g3d.getMeshSubmeshEnd(g3dMesh)

    for (let sub = subStart; sub < subEnd; sub++) {
      const start = g3d.getSubmeshIndexStart(sub)
      const end = g3d.getSubmeshIndexEnd(sub)
      const color = g3d.getSubmeshColor(sub)
      for (let i = start; i < end; i++) {
        const v = indices.getX(mergedIndex)
        colors.setXYZ(v, color[0], color[1], color[2])
        mergedIndex++
      }
    }
    colors.needsUpdate = true
    colors.updateRange.offset = 0
    colors.updateRange.count = -1
  }

  /**
   * Adds an instanceColor buffer to the instanced mesh and sets new color for given instance
   */
  private applyInstancedColor (sub: SubMesh, color: THREE.Color | undefined) {
    const colors = this.getOrAddInstanceColorAttribute(
      sub.three as THREE.InstancedMesh
    )
    if (color) {
      // Set instance to use instance color provided
      colors.setXYZ(sub.index, color.r, color.g, color.b)
      // Set attributes dirty
      colors.needsUpdate = true
      colors.updateRange.offset = 0
      colors.updateRange.count = -1
    }
  }

  private getOrAddInstanceColorAttribute (mesh: THREE.InstancedMesh) {
    if (mesh.instanceColor) return mesh.instanceColor
    const count = mesh.instanceMatrix.count
    // Add color instance attribute
    const colors = new Float32Array(count * 3)
    const attribute = new THREE.InstancedBufferAttribute(colors, 3)
    mesh.instanceColor = attribute
    return attribute
  }
}
