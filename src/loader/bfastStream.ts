import { BFastRange, bfastHeaderSize, readBFastHeader } from './bfast'

/**
 * Routes the bytes of a BFAST file to a destination per buffer as they arrive,
 * so a large file never has to exist in one piece. It knows nothing about where
 * the bytes come from: a network response, a file read, or a test.
 */

/** Receives the bytes of one buffer, in order, at an offset within that buffer. */
export type BFastSink = {
    write(bytes: Uint8Array, offset: number): void;
    /** Called once the buffer is complete. */
    end?(): void;
}

/** Chooses where a buffer's bytes go, or undefined to discard them. */
export type BFastSinkFactory = (range: BFastRange) => BFastSink | undefined

/** Collects a buffer into memory. */
export const memorySink = (into: Uint8Array): BFastSink => ({
  write: (bytes, offset) => into.set(bytes, offset)
})

/**
 * Feed sequential chunks from the start of a BFAST file with {@link push}.
 * The header is parsed as soon as enough bytes have arrived, the sinks are
 * chosen once, and every later chunk is handed straight to them.
 */
export class BFastStreamReader {
  /** Known once the header has been read. */
  ranges: BFastRange[] | undefined

  private readonly sinkFor: BFastSinkFactory
  private head: Uint8Array[] = []
  private headBytes = 0
  private position = 0
  private targets: { range: BFastRange; sink: BFastSink }[] = []
  /** Ranges before this index are finished, so later chunks can skip them. */
  private first = 0

  constructor (sinkFor: BFastSinkFactory) {
    this.sinkFor = sinkFor
  }

  push (chunk: Uint8Array): void {
    if (chunk.length === 0) return
    if (this.ranges) {
      this.route(chunk, this.position)
      this.position += chunk.length
      return
    }

    this.head.push(chunk)
    this.headBytes += chunk.length
    const head = this.tryReadHeader()
    if (!head) return

    // The head was buffered while the header was unknown; route it now.
    this.route(head, 0)
    this.position = head.length
    this.head = []
  }

  /** Signals the end of the file and completes every sink. */
  end (): void {
    if (!this.ranges) {
      throw new Error(
        `The stream ended after ${this.headBytes} bytes, before the BFAST header was complete.`)
    }
    for (const t of this.targets) t.sink.end?.()
  }

  /** Parses the header once enough bytes are buffered, and returns them joined. */
  private tryReadHeader (): Uint8Array | undefined {
    const joined = join(this.head, this.headBytes)
    const needed = bfastHeaderSize(joined.buffer, joined.byteOffset)
    if (needed === undefined || this.headBytes < needed) return undefined

    this.ranges = readBFastHeader(joined.buffer, joined.byteOffset)
    this.targets = this.ranges
      .map((range) => ({ range, sink: this.sinkFor(range) }))
      .filter((t): t is { range: BFastRange; sink: BFastSink } => !!t.sink)
      .sort((a, b) => a.range.begin - b.range.begin)
    return joined
  }

  private route (chunk: Uint8Array, start: number): void {
    const end = start + chunk.length
    while (this.first < this.targets.length && this.targets[this.first].range.end <= start) {
      this.first++
    }
    for (let i = this.first; i < this.targets.length; i++) {
      const { range, sink } = this.targets[i]
      if (range.begin >= end) break
      const from = Math.max(start, range.begin)
      const to = Math.min(end, range.end)
      if (to > from) sink.write(chunk.subarray(from - start, to - start), from - range.begin)
    }
  }
}

/** Reads a whole stream of chunks through a reader. */
export async function readBFastStream (
  chunks: AsyncIterable<Uint8Array>,
  sinkFor: BFastSinkFactory
): Promise<BFastRange[]> {
  const reader = new BFastStreamReader(sinkFor)
  for await (const chunk of chunks) reader.push(chunk)
  reader.end()
  return reader.ranges as BFastRange[]
}

/**
 * Copies the buffered head into one exactly sized array. A chunk can be a view
 * on a larger buffer, and the header reader measures what is available from the
 * underlying buffer, so it must be handed an array that owns its bytes.
 */
const join = (parts: Uint8Array[], total: number): Uint8Array => {
  const out = new Uint8Array(total)
  let at = 0
  for (const p of parts) { out.set(p, at); at += p.length }
  return out
}
