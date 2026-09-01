import { BFastSink } from '../loader/bfastStream'

/**
 * A stream destination that writes into a GPU buffer as the bytes arrive, so
 * the buffer's contents never exist as a JavaScript array.
 *
 * `writeBuffer` copies whole 32-bit words, so a chunk that ends part way
 * through a word holds the remainder back until the next chunk completes it.
 */
export function gpuBufferSink (device: GPUDevice, buffer: GPUBuffer): BFastSink {
  let at = 0
  let carry = new Uint8Array(0)

  return {
    write (bytes, offset) {
      if (offset !== at + carry.length) {
        throw new Error(`GPU sink expected offset ${at + carry.length} but got ${offset}.`)
      }
      let data = bytes
      if (carry.length) {
        const joined = new Uint8Array(carry.length + bytes.length)
        joined.set(carry)
        joined.set(bytes, carry.length)
        data = joined
      }
      const whole = data.length & ~3
      // Copied, not aliased: the caller may reuse the chunk after this returns.
      carry = data.slice(whole)
      if (whole === 0) return
      device.queue.writeBuffer(buffer, at, data.buffer, data.byteOffset, whole)
      at += whole
    },

    end () {
      if (carry.length === 0) return
      // The buffer was allocated with its size rounded up, so the padding is safe.
      const padded = new Uint8Array(4)
      padded.set(carry)
      device.queue.writeBuffer(buffer, at, padded)
      at += carry.length
      carry = new Uint8Array(0)
    }
  }
}
