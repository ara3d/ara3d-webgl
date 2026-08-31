import { InputHost } from './inputHost'
import { KEYS } from './keys'

/** Maps key presses to camera actions. */
export class DefaultInputScheme {
  private _host: InputHost

  constructor (host: InputHost) {
    this._host = host
  }

  onKeyAction (key: number): boolean {
    const camera = this._host.camera
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
        this._host.inputs.pointerActive = this._host.inputs.pointerFallback
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
