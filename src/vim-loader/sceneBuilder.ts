/**
 * @module vim-loader
 */

import { G3d } from 'vim-format'
import { MergeArgs } from './geometry'
import { MeshBuilder } from './meshBuilder'
import { Scene } from './scene'

/**
 * Creates meshes and returns them as a scene from a g3d.
 */
export class SceneBuilder {
  readonly meshBuilder: MeshBuilder

  constructor (meshBuilder?: MeshBuilder) {
    this.meshBuilder = meshBuilder ?? new MeshBuilder()
  }

  /**
   * Creates a new Scene from a g3d by merging mergeable meshes and instancing instantiable meshes
   */
  createFromG3d (g3d: G3d): Scene {
    const scene = new Scene(this)

    // Add instanced geometry
    const shared = this.createFromInstanciableMeshes(g3d)
    scene.merge(shared)

    // Add merged geometry
    scene.merge(
      this.createFromMergeableMeshes(g3d, {
        instances: undefined,
        section: 'opaque',
        transparent: false
      })
    )
    scene.merge(
      this.createFromMergeableMeshes(g3d, {
        instances: undefined,
        section: 'transparent',
        transparent: true
      })
    )

    return scene
  }

  /**
   * Creates a Scene from instantiable meshes from the g3d
   */
  createFromInstanciableMeshes (g3d: G3d) {
    const meshes = this.meshBuilder.createInstancedMeshes(g3d)
    const scene = new Scene(this)
    for (let m = 0; m < meshes.length; m++) {
      scene.addMesh(meshes[m])
    }
    return scene
  }

  /**
   * Creates a Scene from mergeable meshes from the g3d
   */
  createFromMergeableMeshes (g3d: G3d, args: MergeArgs) {
    const scene = new Scene(this)
    const mesh = this.meshBuilder.createMergedMesh(g3d, args)
    if (mesh) scene.addMesh(mesh)
    return scene
  }
}
