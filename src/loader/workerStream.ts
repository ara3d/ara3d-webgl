/**
 * Streams a URL or Blob through a Web Worker. A read loop on the page's main
 * thread is scheduled with everything else the page does and can be starved
 * down to ~20 MB/s (worse in a background tab); a worker's loop has nothing
 * else to do and drains the connection at full speed.
 *
 * The worker coalesces network chunks into large blocks and transfers them,
 * so the main thread handles a few hundred messages per gigabyte instead of
 * tens of thousands. A credit system caps the bytes in flight, so a consumer
 * slower than the connection never buffers more than a few blocks.
 */

/** Bytes per transferred block. */
const BLOCK_BYTES = 8 * 1024 * 1024
/** Blocks the worker may send ahead of the consumer. */
const CREDITS = 4

/** True when this environment can stream through a worker. */
export const canStreamInWorker = () =>
  typeof Worker !== 'undefined' && typeof Blob !== 'undefined'

/** What the worker sends back: one of the fields, never several. */
type WorkerReply = { block?: ArrayBuffer; done?: boolean; error?: string }

const WORKER_CODE = `
const BLOCK_BYTES = ${BLOCK_BYTES}
let credits = ${CREDITS}
let wake = null

onmessage = async (e) => {
  if (e.data.credit) {
    credits += e.data.credit
    if (wake) { wake(); wake = null }
    return
  }
  try {
    const stream = await openStream(e.data.source)
    const reader = stream.getReader()
    let pending = []
    let pendingBytes = 0

    const send = async () => {
      while (credits <= 0) await new Promise((resolve) => { wake = resolve })
      credits--
      const out = new Uint8Array(pendingBytes)
      let at = 0
      for (const c of pending) { out.set(c, at); at += c.length }
      pending = []
      pendingBytes = 0
      postMessage({ block: out.buffer }, [out.buffer])
    }

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      pending.push(value)
      pendingBytes += value.length
      if (pendingBytes >= BLOCK_BYTES) await send()
    }
    if (pendingBytes > 0) await send()
    postMessage({ done: true })
  } catch (err) {
    postMessage({ error: String((err && err.message) || err) })
  }
}

async function openStream (source) {
  if (typeof source !== 'string') return source.stream()
  const response = await fetch(source)
  if (!response.ok) {
    throw new Error('Failed to fetch model from ' + source + ': ' +
      response.status + ' ' + response.statusText)
  }
  return response.body
}
`

/**
 * Reads a URL or Blob as chunks fetched by a worker. The worker is terminated
 * when the iterator finishes, errors, or is abandoned early.
 */
export async function * workerChunks (source: string | Blob): AsyncIterable<Uint8Array> {
  // A blob-URL worker resolves relative URLs against its own blob origin,
  // so resolve against the page here.
  const resolved = typeof source === 'string'
    ? new URL(source, globalThis.location?.href).toString()
    : source

  const worker = new Worker(
    URL.createObjectURL(new Blob([WORKER_CODE], { type: 'text/javascript' })))

  const replies: WorkerReply[] = []
  let notify: (() => void) | null = null
  const push = (reply: WorkerReply) => {
    replies.push(reply)
    if (notify) { notify(); notify = null }
  }
  worker.onmessage = (e: MessageEvent<WorkerReply>) => push(e.data)
  worker.onerror = (e) => push({ error: e.message || 'The streaming worker failed.' })

  try {
    worker.postMessage({ source: resolved })
    for (;;) {
      while (replies.length === 0) {
        await new Promise<void>((resolve) => { notify = resolve })
      }
      const reply = replies.shift() as WorkerReply
      if (reply.error !== undefined) throw new Error(reply.error)
      if (reply.done) return
      yield new Uint8Array(reply.block as ArrayBuffer)
      worker.postMessage({ credit: 1 })
    }
  } finally {
    worker.terminate()
  }
}
