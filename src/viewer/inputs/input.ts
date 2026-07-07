import * as THREE from 'three'
import { Viewer } from '../viewer'
import { KeyboardHandler, KEYS } from './keyboard'
import { TouchHandler } from './touch'
import { MouseHandler } from './mouse'
import { BosFileDropHandler } from './bosFileDrop'
import { SignalDispatcher } from 'ste-signals'
import { SimpleEventDispatcher } from 'ste-simple-events'
export { KEYS } from './keyboard'

/** Pointers mode supported by the viewer */
export type PointerMode = 'orbit' | 'look' | 'pan' | 'zoom' | 'rect';

export class DefaultInputScheme {
  private _viewer: Viewer

  constructor (viewer: Viewer) {
    this._viewer = viewer
  }

  onKeyAction (key: number): boolean {
    const camera = this._viewer.camera
    switch (key) {
      case KEYS.KEY_P:
        camera.orthographic = !camera.orthographic
        return true
      case KEYS.KEY_ADD:
      case KEYS.KEY_OEM_PLUS:
        camera.speed += 1
        return true
      case KEYS.KEY_SUBTRACT:
      case KEYS.KEY_OEM_MINUS:
        camera.speed -= 1
        return true
      case KEYS.KEY_F8:
      case KEYS.KEY_SPACE:
        this._viewer.inputs.pointerActive =
                    this._viewer.inputs.pointerFallback
        return true
      case KEYS.KEY_HOME:
        camera.lerp(1).reset()
        return true
        // Selection
      case KEYS.KEY_ESCAPE:
        return true
      case KEYS.KEY_Z:
      case KEYS.KEY_F:
        camera.lerp(1).frame('all')
        return true
      default:
        return false
    }
  }
}

/**
 * Manages and registers all viewer user inputs for mouse, keyboard and touch
 */
export class Input {
  private _viewer: Viewer
  private _scheme: DefaultInputScheme
  touch: TouchHandler
  mouse: MouseHandler
  keyboard: KeyboardHandler
  bosFileDrop: BosFileDropHandler | undefined

  private _pointerActive: PointerMode = 'orbit'
  private _pointerFallback: PointerMode = 'look'
  private _pointerOverride: PointerMode | undefined

  constructor (viewer: Viewer) {
    this._viewer = viewer
    this._scheme = new DefaultInputScheme(viewer)

    this.keyboard = new KeyboardHandler(viewer)
    this.mouse = new MouseHandler(viewer)
    this.touch = new TouchHandler(viewer)
    if (viewer.settings.fileDrop.enable) {
      this.bosFileDrop = new BosFileDropHandler(viewer)
    }
    this.pointerActive = viewer.settings.camera.controls.orbit
      ? 'orbit'
      : 'look'
    this._pointerFallback = viewer.settings.camera.controls.orbit
      ? 'look'
      : 'orbit'
  }

  /**
     * Returns the last main mode (orbit, look) that was active.
     */
  get pointerFallback () {
    return this._pointerFallback
  }

  /**
     * Returns current pointer mode.
     */
  get pointerActive () {
    return this._pointerActive
  }

  /**
     * A temporary pointer mode used for temporary icons.
     */
  get pointerOverride () {
    return this._pointerOverride
  }

  set pointerOverride (value: PointerMode | undefined) {
    if (value === this._pointerOverride) return
    this._pointerOverride = value
    this._onPointerOverrideChanged.dispatch()
  }

  /**
     * Changes pointer interaction mode. Look mode will set camera orbitMode to false.
     */
  set pointerActive (value: PointerMode) {
    if (value === this._pointerActive) return

    if (value === 'look') this._pointerFallback = 'orbit'
    else if (value === 'orbit') this._pointerFallback = 'look'

    this._pointerActive = value
    this._onPointerModeChanged.dispatch()
  }

  private _onPointerModeChanged = new SignalDispatcher()

  /**
     * Event called when pointer interaction mode changes.
     */
  get onPointerModeChanged () {
    return this._onPointerModeChanged.asEvent()
  }

  private _onPointerOverrideChanged = new SignalDispatcher()

  /**
     * Event called when the pointer is temporarily overriden.
     */
  get onPointerOverrideChanged () {
    return this._onPointerOverrideChanged.asEvent()
  }

  private _onContextMenu = new SimpleEventDispatcher<
        THREE.Vector2 | undefined
    >()

  get onContextMenu () {
    return this._onContextMenu.asEvent()
  }

  get scheme () {
    return this._scheme
  }

  KeyAction (key: number) {
    return this._scheme.onKeyAction(key)
  }

  ContextMenu (position: THREE.Vector2 | undefined) {
    this._onContextMenu.dispatch(position)
  }

  registerAll () {
    this.keyboard.register()
    this.mouse.register()
    this.touch.register()
    this.bosFileDrop?.register()
  }

  unregisterAll = () => {
    this.mouse.unregister()
    this.keyboard.unregister()
    this.touch.unregister()
    this.bosFileDrop?.unregister()
  }

  resetAll () {
    this.mouse.reset()
    this.keyboard.reset()
    this.touch.reset()
    this.bosFileDrop?.reset()
  }
}
