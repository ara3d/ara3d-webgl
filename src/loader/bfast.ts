/**
 * Reader for the BFAST container format: a header of 64-byte aligned ranges
 * followed by the raw bytes of each named buffer.
 * See https://github.com/ara3d/bfast for the specification.
 */

/** First 8 bytes of a little endian BFAST file, read as a 64-bit integer. */
export const BFAST_MAGIC = 0xbfa5

const PREAMBLE_BYTES = 32
const RANGE_BYTES = 16

/** A named run of bytes inside a BFAST file. */
export type BFastBuffer = {
    name: string;
    bytes: Uint8Array;
}

/** The buffers of a BFAST file, in file order, with lookup by name. */
export class BFast {
  readonly buffers: ReadonlyArray<BFastBuffer>
  private readonly byName: Map<string, Uint8Array>

  constructor (buffers: ReadonlyArray<BFastBuffer>) {
    this.buffers = buffers
    this.byName = new Map(buffers.map((b) => [b.name, b.bytes]))
  }

  get names (): string[] { return this.buffers.map((b) => b.name) }

  /** The bytes of `name`, or undefined when the file has no such buffer. */
  find (name: string): Uint8Array | undefined { return this.byName.get(name) }

  /** The bytes of `name`, or an error naming what the file does contain. */
  get (name: string): Uint8Array {
    const bytes = this.byName.get(name)
    if (!bytes) {
      throw new Error(`BFAST has no buffer named "${name}". Found: ${this.names.join(', ')}`)
    }
    return bytes
  }
}

/** True when `buffer` starts with the BFAST magic number. */
export function isBFast (buffer: ArrayBuffer, byteOffset = 0): boolean {
  if (buffer.byteLength - byteOffset < PREAMBLE_BYTES) return false
  const view = new DataView(buffer, byteOffset, 8)
  return view.getUint32(0, true) === BFAST_MAGIC && view.getUint32(4, true) === 0
}

/**
 * Parses a BFAST file into its named buffers. The returned arrays are views on
 * `buffer`, so no bytes are copied and the file must be kept alive.
 */
export function readBFast (buffer: ArrayBuffer, byteOffset = 0): BFast {
  if (!isBFast(buffer, byteOffset)) {
    const magic = buffer.byteLength >= byteOffset + 8
      ? new DataView(buffer, byteOffset, 8).getUint32(0, true).toString(16)
      : 'too short'
    throw new Error(`Not a little endian BFAST file (magic 0x${magic}).`)
  }

  const header = new DataView(buffer, byteOffset, PREAMBLE_BYTES)
  const count = readInt64(header, 24)
  if (count < 1) throw new Error(`BFAST has ${count} buffers; there must be at least one.`)

  const ranges = new DataView(buffer, byteOffset + PREAMBLE_BYTES, count * RANGE_BYTES)
  const range = (i: number): [number, number] =>
    [readInt64(ranges, i * RANGE_BYTES), readInt64(ranges, i * RANGE_BYTES + 8)]

  const slice = ([begin, end]: [number, number]) =>
    new Uint8Array(buffer, byteOffset + begin, end - begin)

  // The first buffer holds the NUL separated names of all the others.
  const names = splitNames(slice(range(0)))
  if (names.length < count - 1) {
    throw new Error(`BFAST has ${count - 1} buffers but only ${names.length} names.`)
  }

  const buffers: BFastBuffer[] = []
  for (let i = 1; i < count; i++) {
    buffers.push({ name: names[i - 1], bytes: slice(range(i)) })
  }
  return new BFast(buffers)
}

/**
 * BFAST sizes are 64-bit, but every buffer we can hold in memory fits in a
 * double, so ranges are read as numbers rather than bigints.
 */
function readInt64 (view: DataView, offset: number): number {
  const value = view.getBigInt64(offset, true)
  if (value > Number.MAX_SAFE_INTEGER || value < 0) {
    throw new Error(`BFAST offset ${value} is out of range.`)
  }
  return Number(value)
}

const splitNames = (bytes: Uint8Array): string[] => {
  const text = new TextDecoder().decode(bytes).replace(/\0+$/, '')
  return text.length === 0 ? [] : text.split('\0')
}
