/**
 * @module vim-loader/materials
 */

import * as THREE from 'three'
import { StandardMaterial } from './standardMaterial'
import { createMaskMaterial } from './maskMaterial'
import { createIsolationMaterial } from './isolationMaterial'
import { OutlineMaterial } from './outlineMaterial'
import { MergeMaterial } from './mergeMaterial'
import { SignalDispatcher } from 'ste-signals'
import { createGridMaterial } from './gridMaterial'

export type MaterialSettings = {
  highlight: {
    color: THREE.Color
    opacity: number
  }
  isolation: {
    color: THREE.Color
    opacity: number
  }
  section: {
    strokeWidth: number
    strokeFalloff: number
    strokeColor: THREE.Color
  }
  outline: {
    intensity: number
    falloff: number
    blur: number
    color: THREE.Color
  }
}

/**
 * Defines the materials to be used by the vim loader and allows for material injection.
 */
export class VimMaterials {
  // eslint-disable-next-line no-use-before-define
  static instance: VimMaterials

  static createInstance (instance: VimMaterials) {
    this.instance = instance
  }

  static getInstance () {
    if (!this.instance) {
      this.instance = new VimMaterials()
    }
    return this.instance
  }

  opaque: StandardMaterial
  transparent: StandardMaterial
  wireframe: THREE.LineBasicMaterial
  isolation: THREE.Material
  mask: THREE.ShaderMaterial
  outline: OutlineMaterial
  merge: MergeMaterial
  grid: THREE.ShaderMaterial

  private _clippingPlanes: THREE.Plane[] | undefined
  private _sectionStrokeWidth: number = 0.01
  private _sectionStrokeFalloff: number = 0.75
  private _sectionStrokeColor: THREE.Color = new THREE.Color(0xf6, 0xf6, 0xf6)
  private _focusIntensity: number = 0.75
  private _focusColor: THREE.Color = new THREE.Color(1, 1, 1)
  private _onUpdate = new SignalDispatcher()

  constructor (
    opaque?: StandardMaterial,
    transparent?: StandardMaterial,
    wireframe?: THREE.LineBasicMaterial,
    isolation?: THREE.Material,
    mask?: THREE.ShaderMaterial,
    outline?: OutlineMaterial,
    merge?: MergeMaterial,
    grid?: THREE.ShaderMaterial
  ) {
    this.opaque = opaque ?? new StandardMaterial(createOpaque())
    this.transparent = transparent ?? new StandardMaterial(createTransparent())
    this.wireframe = wireframe ?? createWireframe()
    this.isolation = isolation ?? createIsolationMaterial()
    this.mask = mask ?? createMaskMaterial()
    this.outline = outline ?? new OutlineMaterial()
    this.merge = merge ?? new MergeMaterial()
    this.grid = grid ?? createGridMaterial()
  }

  applySettings (settings: MaterialSettings) {
    this.isolationOpacity = settings.isolation.opacity
    this.isolationColor = settings.isolation.color

    this.wireframeColor = settings.highlight.color
    this.wireframeOpacity = settings.highlight.opacity

    this.sectionStrokeWidth = settings.section.strokeWidth
    this.sectionStrokeFalloff = settings.section.strokeFalloff
    this.sectionStrokeColor = settings.section.strokeColor

    this.outlineIntensity = settings.outline.intensity
    this.outlineFalloff = settings.outline.falloff
    this.outlineBlur = settings.outline.blur
    this.outlineColor = settings.outline.color
  }

  get onUpdate () {
    return this._onUpdate.asEvent()
  }

  get isolationOpacity () {
    return this.isolation.opacity
  }

  set isolationOpacity (opacity: number) {
    const mat = this.isolation as THREE.ShaderMaterial
    mat.uniforms.opacity.value = opacity
    mat.uniformsNeedUpdate = true
    this._onUpdate.dispatch()
  }

  get isolationColor (): THREE.Color {
    const mat = this.isolation as THREE.ShaderMaterial
    return mat.uniforms.fillColor.value
  }

  set isolationColor (color: THREE.Color) {
    const mat = this.isolation as THREE.ShaderMaterial
    mat.uniforms.fillColor.value = color
    mat.uniformsNeedUpdate = true
    this._onUpdate.dispatch()
  }

  /**
   * Color intensity of focus effect on hover.
   */
  get focusIntensity () {
    return this._focusIntensity
  }

  set focusIntensity (value: number) {
    if (this._focusIntensity === value) return
    this._focusIntensity = value
    this.opaque.focusIntensity = value
    this.transparent.focusIntensity = value
    this._onUpdate.dispatch()
  }

  /**
   * Color of focus effect on hover.
   */
  get focusColor () {
    return this._focusColor
  }

  set focusColor (value: THREE.Color) {
    if (this._focusColor === value) return
    this._focusColor = value
    this.opaque.focusColor = value
    this.transparent.focusColor = value
    this._onUpdate.dispatch()
  }

  /**
   * Default color for wireframe meshes.
   */
  get wireframeColor () {
    return this.wireframe.color
  }

  set wireframeColor (value: THREE.Color) {
    if (this.wireframe.color === value) return
    this.wireframe.color = value
    this._onUpdate.dispatch()
  }

  /**
   * Default opacity for wireframe meshes.
   */
  get wireframeOpacity () {
    return this.wireframe.opacity
  }

  set wireframeOpacity (value: number) {
    if (this.wireframe.opacity === value) return

    this.wireframe.opacity = value
    this._onUpdate.dispatch()
  }

  /**
   * Applies clipping planes to all relevent materials
   */
  get clippingPlanes () {
    return this._clippingPlanes
  }

  set clippingPlanes (value: THREE.Plane[] | undefined) {
    // THREE Materials will break if assigned undefined
    this._clippingPlanes = value
    this.opaque.clippingPlanes = value ?? null
    this.transparent.clippingPlanes = value ?? null
    this.wireframe.clippingPlanes = value ?? null
    this.isolation.clippingPlanes = value ?? null
    this.mask.clippingPlanes = value ?? null
    this.grid.clippingPlanes = value ?? null
    this._onUpdate.dispatch()
  }

  /**
   * Width of the stroke effect where the section box intersects the model.
   */
  get sectionStrokeWidth () {
    return this._sectionStrokeWidth
  }

  set sectionStrokeWidth (value: number) {
    if (this._sectionStrokeWidth === value) return
    this._sectionStrokeWidth = value
    this.opaque.sectionStrokeWitdh = value
    this.transparent.sectionStrokeWitdh = value
    this._onUpdate.dispatch()
  }

  /**
   * Gradient of the stroke effect where the section box intersects the model.
   */
  get sectionStrokeFalloff () {
    return this._sectionStrokeFalloff
  }

  set sectionStrokeFalloff (value: number) {
    if (this._sectionStrokeFalloff === value) return
    this._sectionStrokeFalloff = value
    this.opaque.sectionStrokeFallof = value
    this.transparent.sectionStrokeFallof = value
    this._onUpdate.dispatch()
  }

  /**
   * Color of the stroke effect where the section box intersects the model.
   */
  get sectionStrokeColor () {
    return this._sectionStrokeColor
  }

  set sectionStrokeColor (value: THREE.Color) {
    if (this._sectionStrokeColor === value) return
    this._sectionStrokeColor = value
    this.opaque.sectionStrokeColor = value
    this.transparent.sectionStrokeColor = value
    this._onUpdate.dispatch()
  }

  /**
   * Color of the selection outline effect
   */
  get outlineColor () {
    return this.merge.color
  }

  set outlineColor (value: THREE.Color) {
    if (this.merge.color === value) return
    this.merge.color = value
    this._onUpdate.dispatch()
  }

  /**
   * Size of the blur convolution on the selection outline effect
   */
  get outlineBlur () {
    return this.outline.strokeBlur
  }

  set outlineBlur (value: number) {
    if (this.outline.strokeBlur === value) return
    this.outline.strokeBlur = value
    this._onUpdate.dispatch()
  }

  /**
   * Gradient of the the selection outline effect
   */
  get outlineFalloff () {
    return this.outline.strokeBias
  }

  set outlineFalloff (value: number) {
    if (this.outline.strokeBias === value) return
    this.outline.strokeBias = value
    this._onUpdate.dispatch()
  }

  /**
   * Intensity of the the selection outline effect
   */
  get outlineIntensity () {
    return this.outline.strokeMultiplier
  }

  set outlineIntensity (value: number) {
    if (this.outline.strokeMultiplier === value) return
    this.outline.strokeMultiplier = value
    this._onUpdate.dispatch()
  }

  /** dispose all materials. */
  dispose () {
    this.opaque.dispose()
    this.transparent.dispose()
    this.wireframe.dispose()
    this.isolation.dispose()
    this.mask.dispose()
    this.outline.dispose()
  }
}

/**
 * Creates a non-custom instance of phong material as used by the vim loader
 * @returns a THREE.MeshPhongMaterial
 */
export function createOpaque () {
  return new THREE.MeshPhongMaterial({
    color: 0x999999,
    vertexColors: true,
    flatShading: true,
    side: THREE.DoubleSide,
    shininess: 5
  })
}

/**
 * Creates a new instance of the default loader transparent material
 * @returns a THREE.MeshPhongMaterial
 */
export function createTransparent () {
  const mat = createOpaque()
  mat.transparent = true
  mat.shininess = 70
  return mat
}

/**
 * Creates a new instance of the default wireframe material
 * @returns a THREE.LineBasicMaterial
 */
export function createWireframe () {
  return new THREE.LineBasicMaterial({
    depthTest: false,
    opacity: 1,
    color: new THREE.Color(0x0000ff),
    transparent: true
  })
}
