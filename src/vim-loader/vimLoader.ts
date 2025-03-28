/**
 * @module vim-loader
 */

import { SceneBuilder } from './sceneBuilder'
import { BFast, G3d, RemoteBuffer, requestHeader, VimDocument, VimHeader } from 'vim-format'

import { VimMaterials } from '../materials/materials'
import { MeshBuilder } from './meshBuilder'
import { ElementMapping } from './elementMapping'
import { Vim } from './vim'
import * as THREE from 'three'
import { ILogger } from '../utils/ILogger'

export type VimSettings = {
  position: THREE.Vector3
  rotation: THREE.Vector3
  scale: number
}

/**
 * Loader for the Vim File format.
 * See https://github.com/vimaec/vim
 */
export class VimLoader {
  readonly sceneBuilder: SceneBuilder
  readonly meshBuilder: MeshBuilder

  constructor () {
    this.meshBuilder = new MeshBuilder(VimMaterials.getInstance())
    this.sceneBuilder = new SceneBuilder(this.meshBuilder)
  }

  static readonly defaultSettings: VimSettings = {
      rotation: new THREE.Vector3(270, 0, 0),
      scale: 1,
      position: new THREE.Vector3(0, 0, 0),
  }

  async load(source: string | ArrayBuffer, logger: ILogger = undefined, settings: VimSettings = undefined)
  {
    const time = Date.now()
    const buffer = typeof source === 'string'
      ? new RemoteBuffer(source)
      : source;
    const bfast = new BFast(buffer, 0, 'vim');
    const localSettings = { ...VimLoader.defaultSettings, ...settings };
    const result =  this.loadFromBFast(bfast, localSettings);
    logger?.log(`Finished Loading in ${((Date.now() - time) / 1000).toFixed(2)} seconds`)
    return result;
  }

  async loadFromBFast (bfast: BFast, settings: VimSettings) {
    await bfast.forceDownload()
    const doc = await VimDocument.createFromBfast(bfast)
    const [header, g3d, instanceToElement, elementIds] = await Promise.all([
      VimLoader.requestHeader(bfast),
      VimLoader.requestG3d(bfast),
      doc.node.getAllElementIndex(),
      doc.element.getAllId()
    ])
    const scene = this.sceneBuilder.createFromG3d(g3d)
    const mapping = new ElementMapping(
      Array.from(g3d.instanceNodes),
      instanceToElement!,
      elementIds!
    )
    const pos = settings?.position ?? new THREE.Vector3()
    const rot = settings?.rotation ?? new THREE.Vector3()
    const scl = settings?.scale ?? 1
    const matrix = new THREE.Matrix4().compose(
      pos,
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
          (rot.x * Math.PI) / 180,
          (rot.y * Math.PI) / 180,
          (rot.z * Math.PI) / 180)),
      new THREE.Vector3(scl, scl, scl))
    return new Vim(header, doc, g3d, scene, matrix, mapping)
  }

  public static async requestHeader (bfast: BFast): Promise<VimHeader> {
    const header = await requestHeader(bfast)
    if (!header) {
      throw new Error('Could not get VIM file header.')
    }
    return header
  }

  private static async requestG3d (bfast: BFast) {
    const geometry = await bfast.getLocalBfast('geometry')
    if (!geometry) {
      throw new Error('Could not get G3D Data from VIM file.')
    }
    return await G3d.createFromBfast(geometry)
  }
}
