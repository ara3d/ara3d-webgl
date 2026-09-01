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
  const { first, count } = range
  if (count < 2) return false

  // Squared distance from the eye to each slot's sphere center.
  const keys = new Float64Array(count)
  let sorted = true
  for (let i = 0; i < count; i++) {
    const s = (first + i) * 4
    const dx = instanceSpheres[s] - eye.x
    const dy = instanceSpheres[s + 1] - eye.y
    const dz = instanceSpheres[s + 2] - eye.z
    keys[i] = dx * dx + dy * dy + dz * dz
    if (i > 0 && keys[i] < keys[i - 1]) sorted = false
  }
  if (sorted) return false

  const order = new Uint32Array(count)
  for (let i = 0; i < count; i++) order[i] = i
  order.sort((a, b) => keys[a] - keys[b])

  // Apply the permutation via scratch copies of the range.
  const cmds = drawCommands.slice(
    first * DRAW_COMMAND_WORDS, (first + count) * DRAW_COMMAND_WORDS)
  const spheres = instanceSpheres.slice(first * 4, (first + count) * 4)
  const ids = instanceIds.slice(first, first + count)
  for (let i = 0; i < count; i++) {
    const src = order[i]
    const dc = (first + i) * DRAW_COMMAND_WORDS
    const sc = src * DRAW_COMMAND_WORDS
    for (let w = 0; w < DRAW_COMMAND_WORDS; w++) {
      drawCommands[dc + w] = cmds[sc + w]
    }
    const ds = (first + i) * 4
    const ss = src * 4
    instanceSpheres[ds] = spheres[ss]
    instanceSpheres[ds + 1] = spheres[ss + 1]
    instanceSpheres[ds + 2] = spheres[ss + 2]
    instanceSpheres[ds + 3] = spheres[ss + 3]
    instanceIds[first + i] = ids[src]
  }
  return true
}
