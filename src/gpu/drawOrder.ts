import { DRAW_COMMAND_WORDS, DrawRange } from './gpuScene'

/**
 * Sorts the draw commands of `range` in place by ascending distance from
 * `eye` to each instance's bounding sphere center, so opaque geometry draws
 * front to back and early depth testing rejects hidden fragments.
 *
 * The commands, spheres and ids are parallel arrays indexed by draw slot, so
 * all three are permuted together; the instance records themselves stay put
 * because each command carries its own firstInstance.
 *
 * Returns true when the order changed, so the caller knows to re-upload.
 */
export function sortDrawsFrontToBack (
  drawCommands: Uint32Array,
  instanceSpheres: Float32Array,
  instanceIds: Uint32Array,
  range: DrawRange,
  eye: { x: number; y: number; z: number }
): boolean {
  // TODO: implemented by the draw-order track.
  void drawCommands; void instanceSpheres; void instanceIds; void range; void eye
  return false
}
