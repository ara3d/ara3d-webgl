/**
 * Minimal BFAST writer, used by the tests to produce fixtures.
 * The library only reads BFAST, so this deliberately lives outside `src`.
 */
const ALIGNMENT = 64
const PREAMBLE_BYTES = 32
const RANGE_BYTES = 16

const align = (n: number) => (n + ALIGNMENT - 1) & ~(ALIGNMENT - 1)

/** Packs named buffers into BFAST bytes, 64-byte aligning each one. */
export function writeBFast (buffers: { name: string; bytes: Uint8Array }[]): Uint8Array {
  const nameBytes = new TextEncoder().encode(buffers.map((b) => b.name).join('\0') + '\0')
  const payloads = [nameBytes, ...buffers.map((b) => b.bytes)]
  const count = payloads.length

  const ranges: [number, number][] = []
  let at = align(PREAMBLE_BYTES + count * RANGE_BYTES)
  for (const p of payloads) {
    ranges.push([at, at + p.byteLength])
    at = align(at + p.byteLength)
  }

  const out = new Uint8Array(align(ranges[ranges.length - 1][1]))
  const view = new DataView(out.buffer)
  view.setBigInt64(0, BigInt(0xbfa5), true)
  view.setBigInt64(8, BigInt(ranges[0][0]), true)
  view.setBigInt64(16, BigInt(ranges[ranges.length - 1][1]), true)
  view.setBigInt64(24, BigInt(count), true)

  ranges.forEach(([begin, end], i) => {
    view.setBigInt64(PREAMBLE_BYTES + i * RANGE_BYTES, BigInt(begin), true)
    view.setBigInt64(PREAMBLE_BYTES + i * RANGE_BYTES + 8, BigInt(end), true)
  })

  payloads.forEach((p, i) => out.set(p, ranges[i][0]))
  return out
}

export const bytesOf = (a: ArrayBufferView) =>
  new Uint8Array(a.buffer, a.byteOffset, a.byteLength)
