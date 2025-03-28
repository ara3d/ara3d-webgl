/**
 * @module vim-loader
 */

import * as THREE from 'three'
import { G3d, MeshSection } from 'vim-format'
import { Geometry, MergeArgs } from './geometry'
import { VimMaterials } from '../materials/materials'
import { Mesh } from './mesh'

/**
 * Builds meshes from the g3d and BufferGeometry
 * Allows to reuse the same material for all new built meshes
 */
export class MeshBuilder {
  readonly materials: VimMaterials

  constructor (materials?: VimMaterials) {
    this.materials = materials ?? new VimMaterials()
  }

  /**
   * Creates Instanced Meshes from the g3d data
   */
  createInstancedMeshes (g3d: G3d) {
    const result: (Mesh | undefined)[] = []

    for (let mesh = 0; mesh < g3d.getMeshCount(); mesh++) {
      let meshInstances = g3d.meshInstances[mesh]
      if (!meshInstances?.length) continue
      if (meshInstances.length <= 1) continue

      const createMesh = (section: MeshSection, transparent: boolean) => {
        const count = g3d.getMeshSubmeshCount(mesh, section)
        if (count <= 0) return

        const geometry = Geometry.createGeometryFromMesh(
          g3d,
          mesh,
          section,
          transparent)

        return this.createInstancedMesh(
          geometry,
          g3d,
          meshInstances,
          transparent
        )
      }

      result.push(createMesh('opaque', false))
      result.push(createMesh('transparent', true))
    }
    return result.filter((m): m is Mesh => !!m)
  }

  /**
   * Creates a InstancedMesh from g3d data and given instance indices
   * @returns a THREE.InstancedMesh
   */
  createInstancedMesh (
    geometry: THREE.BufferGeometry,
    g3d: G3d,
    instances: number[],
    useAlpha: boolean
  ) {
    const material = useAlpha
      ? this.materials.transparent
      : this.materials.opaque

    const mesh = new THREE.InstancedMesh(
      geometry,
      material.material,
      instances.length
    )
      geometry.computeBoundingBox()

    const boxes: THREE.Box3[] = []
    for (let i = 0; i < instances.length; i++) {
      const matrix = Geometry.getInstanceMatrix(g3d, instances[i])
      mesh.setMatrixAt(i, matrix)
      boxes[i] = geometry.boundingBox!.clone().applyMatrix4(matrix)
    }
    const nodes = instances.map((i) => g3d.instanceNodes[i])
    return Mesh.createInstanced(mesh, nodes, boxes)
  }

  /**
   * Create a merged mesh from g3d instance indices
   */
  createMergedMesh (g3d: G3d, args: MergeArgs) {
    const merge = args.instances
      ? Geometry.mergeInstanceMeshes(g3d, args)
      : Geometry.mergeUniqueMeshes(g3d, args)
    if (!merge) return

    const material = args.transparent
      ? this.materials.transparent
      : this.materials.opaque

    const mesh = new THREE.Mesh(merge.geometry, material.material)
    const nodes = merge.instances.map((i) => g3d.instanceNodes[i])
    return Mesh.createMerged(mesh, nodes, merge.boxes, merge.submeshes)
  }

  /**
   * Create a wireframe mesh from g3d instance indices
   */
  createWireframe (g3d: G3d, instances: number[]) {
    const geometry = Geometry.createGeometryFromInstances(g3d, {
      section: 'all',
      transparent: false,
      instances })
    if (!geometry) return
    const wireframe = new THREE.WireframeGeometry(geometry)
    return new THREE.LineSegments(wireframe, this.materials.wireframe)
  }
}
