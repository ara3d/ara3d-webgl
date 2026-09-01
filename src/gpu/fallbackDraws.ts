import { DRAW_COMMAND_WORDS, DrawRange, GpuScene, drawCount } from './gpuScene'

/**
 * A reduced set of draw commands for renderers without the multi-draw
 * extension, where every command costs a separate call each frame. The
 * commands still name their original instance slots, so the instance and
 * sphere buffers of the full scene serve unchanged.
 */
export type FallbackDraws = {
    commands: Uint32Array;
    opaque: DrawRange;
    transparent: DrawRange;
}

/**
 * Picks the `limit` draws with the largest world-space bounding spheres,
 * keeping the opaque-then-transparent ordering. Millions of per-frame draw
 * calls can hang the GPU driver and take the desktop down with it; showing
 * the biggest parts of the model is the useful thing a slow path can do.
 */
export function selectLargestDraws (scene: GpuScene, limit: number): FallbackDraws {
  const n = drawCount(scene)
  if (n <= limit) {
    return { commands: scene.drawCommands, opaque: scene.opaque, transparent: scene.transparent }
  }

  const radius = (slot: number) => scene.instanceSpheres[slot * 4 + 3]
  const threshold = radiusThreshold(scene, n, limit)

  // Two passes keep slot order, so opaque slots stay ahead of transparent
  // ones: first everything clearly above the cut, then ties up to the limit.
  const selected: number[] = []
  for (let slot = 0; slot < n; slot++) {
    if (radius(slot) > threshold) selected.push(slot)
  }
  for (let slot = 0; slot < n && selected.length < limit; slot++) {
    if (radius(slot) === threshold) selected.push(slot)
  }
  selected.sort((a, b) => a - b)

  const commands = new Uint32Array(selected.length * DRAW_COMMAND_WORDS)
  for (let i = 0; i < selected.length; i++) {
    const from = selected[i] * DRAW_COMMAND_WORDS
    for (let w = 0; w < DRAW_COMMAND_WORDS; w++) {
      commands[i * DRAW_COMMAND_WORDS + w] = scene.drawCommands[from + w]
    }
  }

  const firstTransparent = scene.transparent.first
  let opaqueCount = 0
  while (opaqueCount < selected.length && selected[opaqueCount] < firstTransparent) opaqueCount++

  return {
    commands,
    opaque: { first: 0, count: opaqueCount },
    transparent: { first: opaqueCount, count: selected.length - opaqueCount }
  }
}

/** The radius of the `limit`-th largest sphere, found with one typed sort. */
function radiusThreshold (scene: GpuScene, n: number, limit: number): number {
  const radii = new Float32Array(n)
  for (let slot = 0; slot < n; slot++) radii[slot] = scene.instanceSpheres[slot * 4 + 3]
  radii.sort()
  return radii[n - limit]
}
