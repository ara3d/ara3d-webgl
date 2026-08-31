import * as THREE from 'three'
import { KeyboardHandler } from './keyboard'
import { TouchHandler } from './touch'
import { MouseHandler } from './mouse'
import { InputHandler } from './inputHandler'
import { InputHost, InputModes, PointerMode } from './inputHost'
import { DefaultInputScheme } from './defaultInputScheme'
import { SignalDispatcher } from 'ste-signals'
import { SimpleEventDispatcher } from 'ste-simple-events'
import type { BosFileDropHandler } from './bosFileDrop'
export { KEYS } from './keys'
export { DefaultInputScheme } from './defaultInputScheme'
export type { PointerMode } from './inputHost'

/**
 * Manages and registers all user inputs for mouse, keyboard and touch.
 * File drop is optional and supplied by the host, which keeps this usable
 * by any host, not just the Three.js viewer.
 */
export class Input implements InputModes {
  private _scheme: DefaultInputScheme
  touch: TouchHandler
  mouse: MouseHandler
  keyboard: KeyboardHandler
  bosFileDrop: BosFileDropHandler | undefined

  private _pointerActive: PointerMode = 'orbit'
  private _pointerFallback: PointerMode = 'look'
  private _pointerOverride: PointerMode | undefined

  constructor (host: InputHost, fileDrop?: BosFileDropHandler) {
    this._scheme = new DefaultInputScheme(host)

    this.keyboard = new KeyboardHandler(host)
    this.mouse = new MouseHandler(host)
    this.touch = new TouchHandler(host)
    this.bosFileDrop = fileDrop

    this.pointerActive = host.settings.camera.controls.orbit ? 'orbit' : 'look'
    this._pointerFallback = host.settings.camera.controls.orbit
      ? 'look'
      : 'orbit'
  }

  private get handlers (): InputHandler[] {
    const all: InputHandler[] = [this.keyboard, this.mouse, this.touch]
    if (this.bosFileDrop) all.push(this.bosFileDrop)
    return all
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
    this.handlers.forEach((h) => h.register())
  }

  unregisterAll = () => {
    this.handlers.forEach((h) => h.unregister())
  }

  resetAll () {
    this.handlers.forEach((h) => h.reset())
  }
}
