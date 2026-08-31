import * as THREE from 'three'
import { InputHandler } from './inputHandler'
import { KEYS, KeySet } from './keys'
export { KEYS } from './keys'

/**
 * Manages keyboard user inputs
 */
export class KeyboardHandler extends InputHandler {
  private SHIFT_MULTIPLIER: number = 3.0

  isUpPressed: boolean = false
  isDownPressed: boolean = false
  isLeftPressed: boolean = false
  isRightPressed: boolean = false
  isEPressed: boolean = false
  isQPressed: boolean = false
  isShiftPressed: boolean = false
  isCtrlPressed: boolean = false
  arrowsEnabled: boolean = true

  protected override addListeners (): void {
    this.reg(document, 'keydown', (e) => this.onKeyDown(e))
    this.reg(document, 'keyup', (e) => this.onKeyUp(e))
    this.reg(this._host.viewport.canvas, 'focusout', () => this.reset())
    this.reg(window, 'resize', () => this.reset())
  }

  override reset () {
    this.isUpPressed = false
    this.isDownPressed = false
    this.isLeftPressed = false
    this.isRightPressed = false
    this.isEPressed = false
    this.isQPressed = false
    this.isShiftPressed = false
    this.isCtrlPressed = false
    this.applyMove()
  }

  private get camera () {
    return this._host.camera
  }

  private onKeyUp (event: KeyboardEvent) {
    this.onKey(event, false)
  }

  private onKeyDown (event: KeyboardEvent) {
    this.onKey(event, true)
  }

  private onKey (event: KeyboardEvent, keyDown: boolean) {
    // Buttons that activate once on key up
    if (!keyDown && KeySet.has(event.keyCode)) {
      if (this._host.inputs.KeyAction(event.keyCode)) {
        event.preventDefault()
      }
    }

    // Camera Movement, Buttons that need constant state refresh
    switch (event.keyCode) {
      case KEYS.KEY_W:
      case KEYS.KEY_UP:
        this.isUpPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_S:
      case KEYS.KEY_DOWN:
        this.isDownPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_D:
      case KEYS.KEY_RIGHT:
        this.isRightPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_A:
      case KEYS.KEY_LEFT:
        this.isLeftPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_E:
        this.isEPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_Q:
        this.isQPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_SHIFT:
        this.isShiftPressed = keyDown
        this.applyMove()
        event.preventDefault()
        break
      case KEYS.KEY_CTRL:
        this.isCtrlPressed = keyDown
        event.preventDefault()
        break
    }
  }

  private applyMove () {
    const move = new THREE.Vector3(
      (this.isRightPressed ? 1 : 0) - (this.isLeftPressed ? 1 : 0),
      (this.isEPressed ? 1 : 0) - (this.isQPressed ? 1 : 0),
      (this.isUpPressed ? 1 : 0) - (this.isDownPressed ? 1 : 0)
    )
    const speed = this.isShiftPressed ? this.SHIFT_MULTIPLIER : 1
    move.multiplyScalar(speed)
    if (this.arrowsEnabled) {
      this.camera.localVelocity = move
      this._host.requestRender()
    }
  }
}
