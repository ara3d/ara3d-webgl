/**
 * Reader for the BFAST container format: a header of 64-byte aligned ranges
 * followed by the raw bytes of each named buffer.
 * See https://github.com/ara3d/bfast for the specification.
 */

/** First 8 bytes of a little endian BFAST file, read as a 64-bit integer. */
export const BFAST_MAGIC = 0xbfa5

const PREAMBLE_BYTES = 32
const RANGE_BYTES = 16

/** Where one named buffer sits in the file. */
export type BFastRange = {
    name: string;
    /** Byte offset of the first byte, from the start of the file. */
    begin: number;
    /** Byte offset one past the last byte. */
    end: number;
}

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
export function isBFast (buffer: ArrayBufferLike, byteOffset = 0): boolean {
  if (buffer.byteLength - byteOffset < PREAMBLE_BYTES) return false
  const view = new DataView(buffer, byteOffset, 8)
  return view.getUint32(0, true) === BFAST_MAGIC && view.getUint32(4, true) === 0
}

/**
 * Reads where every buffer lives without needing the buffers themselves, so a
 * caller holding only the head of the file can fetch or upload each one on its
 * own. The prefix must cover the preamble, the ranges, and the name buffer;
 * `BFAST_HEADER_PROBE` bytes is enough for any file we write.
 */
export function readBFastHeader (buffer: ArrayBufferLike, byteOffset = 0): BFastRange[] {
  if (!isBFast(buffer, byteOffset)) {
    const magic = buffer.byteLength >= byteOffset + 8
      ? new DataView(buffer, byteOffset, 8).getUint32(0, true).toString(16)
      : 'too short'
    throw new Error(`Not a little endian BFAST file (magic 0x${magic}).`)
  }

  const available = buffer.byteLength - byteOffset
  const header = new DataView(buffer, byteOffset, PREAMBLE_BYTES)
  const count = readInt64(header, 24)
  if (count < 1) throw new Error(`BFAST has ${count} buffers; there must be at least one.`)

  const rangesEnd = PREAMBLE_BYTES + count * RANGE_BYTES
  requireBytes(available, rangesEnd, 'range table')

  const ranges = new DataView(buffer, byteOffset + PREAMBLE_BYTES, count * RANGE_BYTES)
  const at = (i: number): [number, number] =>
    [readInt64(ranges, i * RANGE_BYTES), readInt64(ranges, i * RANGE_BYTES + 8)]

  // The first buffer holds the NUL separated names of all the others.
  const [nameBegin, nameEnd] = at(0)
  requireBytes(available, nameEnd, 'name buffer')
  const names = splitNames(new Uint8Array(buffer, byteOffset + nameBegin, nameEnd - nameBegin))
  if (names.length < count - 1) {
    throw new Error(`BFAST has ${count - 1} buffers but only ${names.length} names.`)
  }

  const out: BFastRange[] = []
  for (let i = 1; i < count; i++) {
    const [begin, end] = at(i)
    out.push({ name: names[i - 1], begin, end })
  }
  return out
}

/** Bytes of the file that {@link readBFastHeader} is certain to be able to read. */
export const BFAST_HEADER_PROBE = 64 * 1024

/**
 * How many bytes from the start of the file {@link readBFastHeader} needs,
 * deduced from the bytes available so far, or undefined while even that cannot
 * be told yet. A reader feeding a stream can call this after each chunk: the
 * answer only ever grows, and settles after at most two rounds.
 */
export function bfastHeaderSize (buffer: ArrayBufferLike, byteOffset = 0): number | undefined {
  const available = buffer.byteLength - byteOffset
  if (available < PREAMBLE_BYTES) return undefined

  const count = readInt64(new DataView(buffer, byteOffset, PREAMBLE_BYTES), 24)
  if (count < 1) throw new Error(`BFAST has ${count} buffers; there must be at least one.`)

  const rangesEnd = PREAMBLE_BYTES + count * RANGE_BYTES
  if (available < rangesEnd) return rangesEnd

  // The name buffer is the first range, and the last thing the header needs.
  return readInt64(new DataView(buffer, byteOffset + PREAMBLE_BYTES, RANGE_BYTES), 8)
}

/**
 * Parses a BFAST file into its named buffers. The returned arrays are views on
 * `buffer`, so no bytes are copied and the file must be kept alive.
 */
export function readBFast (buffer: ArrayBufferLike, byteOffset = 0): BFast {
  const ranges = readBFastHeader(buffer, byteOffset)
  const available = buffer.byteLength - byteOffset
  return new BFast(ranges.map(({ name, begin, end }) => {
    requireBytes(available, end, `buffer "${name}"`)
    return { name, bytes: new Uint8Array(buffer, byteOffset + begin, end - begin) }
  }))
}

const requireBytes = (available: number, needed: number, what: string) => {
  if (available < needed) {
    throw new Error(`BFAST ${what} needs ${needed} bytes but only ${available} are present.`)
  }
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
