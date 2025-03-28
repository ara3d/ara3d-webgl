/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'

// internal
import { Settings, getSettings, PartialSettings } from './viewerSettings'
import { Camera } from './camera/camera'
import { Input } from './inputs/input'
import { Selection } from './selection'
import { Environment, IEnvironment } from './environment'
import { Raycaster } from './raycaster'
import { GizmoOrbit } from './gizmos/gizmoOrbit'
import { RenderScene } from './rendering/renderScene'
import { Viewport } from './viewport'
import { GizmoAxes } from './gizmos/gizmoAxes'
import { SectionBox } from './gizmos/sectionBox/sectionBox'
import { Measure, IMeasure } from './gizmos/measure/measure'
import { GizmoRectangle } from './gizmos/gizmoRectangle'

// loader
import { Vim } from '../vim-loader/vim'
import { Renderer } from './rendering/renderer'
import { GizmoGrid, VimMaterials } from '../index'
import { SignalDispatcher } from 'ste-signals'

/**
 * Viewer and loader for vim files.
 */
export class Viewer {
  settings: Settings
  renderer: Renderer
  viewport: Viewport
  selection: Selection
  inputs: Input
  raycaster: Raycaster
  sectionBox: SectionBox
  measure: IMeasure
  gizmoRectangle: GizmoRectangle
  grid: GizmoGrid
  materials: VimMaterials
  get camera () {
    return this._camera
  }

  /**
   * Interface to manipulate THREE elements not directly related to vim.
   */
  get environment () {
    return this._environment as IEnvironment
  }

  /**
   * Signal dispatched when a new vim is loaded or unloaded.
   */
  get onVimLoaded () {
    return this._onVimLoaded.asEvent()
  }

  private _environment: Environment
  private _camera: Camera
  private _clock = new THREE.Clock()
  private _gizmoAxes: GizmoAxes
  private _gizmoOrbit: GizmoOrbit

  // State
  private _vims = new Set<Vim>()
  private _onVimLoaded = new SignalDispatcher()
  private _updateId: number

  constructor (options?: PartialSettings) {
    this.settings = getSettings(options)

    this.materials = VimMaterials.getInstance()

    const scene = new RenderScene()
    this.viewport = new Viewport(this.settings)
    this._camera = new Camera(scene, this.viewport, this.settings)
    this.renderer = new Renderer(
      scene,
      this.viewport,
      this.materials,
      this._camera,
      this.settings
    )

    this.gizmoRectangle = new GizmoRectangle(this)
    this.inputs = new Input(this)

    if (this.settings.camera.gizmo.enable) {
      this._gizmoOrbit = new GizmoOrbit(
        this.renderer,
        this._camera,
        this.inputs,
        this.settings
      )
    }
    this.materials.applySettings(this.settings.materials)

    this.measure = new Measure(this)
    this._gizmoAxes = new GizmoAxes(this.camera, this.settings.axes)
    this.viewport.canvas.parentElement?.prepend(this._gizmoAxes.canvas)

    this.sectionBox = new SectionBox(this)

    this.grid = new GizmoGrid(this.renderer, this.materials)

    this._environment = new Environment(this.settings)
    this._environment.getObjects().forEach((o) => this.renderer.add(o))

    // Input and Selection
    this.selection = new Selection(this.materials)
    this.raycaster = new Raycaster(
      this.viewport,
      this._camera,
      scene,
      this.renderer
    )

    this.inputs.registerAll()

    // Start Loop
    this.animate()
  }

  // Calls render, and asks the framework to prepare the next frame
  private animate () {
    this._updateId = requestAnimationFrame(() => this.animate())
    // Camera
    this.renderer.needsUpdate = this._camera.update(this._clock.getDelta())
    // Rendering
    this.renderer.render()
  }

  /**
   * Returns an array with all loaded vims.
   */
  get vims () {
    return Array.from(this._vims)
  }

  add (vim: Vim, frameCamera = true) {
    if (this._vims.has(vim)) {
      throw new Error('Vim cannot be added again, unless removed first.')
    }

    const success = this.renderer.add(vim.scene)
    if (!success) {
      vim.dispose()
      throw new Error(
        'Could not load vim. Max geometry memory reached. Vim disposed.'
      )
    }
    this._vims.add(vim)

    const box = this.renderer.getBoundingBox()
    if (box) {
      this._environment.adaptToContent(box)
      this.sectionBox.fitBox(box)
    }

    if (frameCamera) {
      this._camera.do(true).frame('all', this._camera.defaultForward)
      this._camera.save()
    }

    this._onVimLoaded.dispatch()
  }

  /**
   * Unload given vim from viewer.
   */
  remove (vim: Vim) {
    if (!this._vims.has(vim)) {
      throw new Error('Cannot remove missing vim from viewer.')
    }

    this._vims.add(vim)
    this.renderer.remove(vim.scene)
    vim.dispose()
    if (this.selection.vim === vim) {
      this.selection.clear()
    }
    this._onVimLoaded.dispatch()
  }

  /**
   * Unloads all vim from viewer.
   */
  clear () {
    this.vims.forEach((v) => this.remove(v))
  }

  /**
   * Disposes all resources.
   */
  dispose () {
    cancelAnimationFrame(this._updateId)
    this.selection.dispose()
    this._environment.dispose()
    this.selection.clear()
    this._gizmoOrbit.dispose()
    this.viewport.dispose()
    this.renderer.dispose()
    this.inputs.unregisterAll()
    this._vims.forEach((v) => v?.dispose())
    this.materials.dispose()
    this.gizmoRectangle.dispose()
  }
}
