/**
 * Headless test for the BFAST stream router.
 * Feeds a file through the router in chunks and checks that every buffer is
 * reassembled byte for byte against reading the same file whole. Chunk sizes
 * are varied, including sizes that split the header, so boundary handling is
 * covered without needing a browser or a GPU.
 *
 * Usage:
 *   node_modules/esbuild-windows-64/esbuild.exe tests/bfastStreamHarness.mts --bundle --platform=node --format=cjs --outfile=out/bfastStream.cjs
 *   node --max-old-space-size=8192 out/bfastStream.cjs <path-to.bfast ...>
 */
import { readFileSync } from 'fs'
import { basename } from 'path'
import { readBFast } from '../src/loader/bfast'
import { BFastStreamReader, memorySink, readBFastStream } from '../src/loader/bfastStream'
import { writeBFast } from './writeBFast.mjs'

let failures = 0
const check = (ok: boolean, message: string) => {
  if (ok) return
  failures++
  console.log(`FAIL: ${message}`)
}

const equal = (a: Uint8Array, b: Uint8Array) => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

/** Chunk sizes chosen to land inside the preamble, the range table, and the names. */
const CHUNK_SIZES = [1, 7, 32, 33, 64, 199, 4096, 65536, 1 << 20]

/** Splits `bytes` into chunks, using a size that varies when `vary` is set. */
function * chunked (bytes: Uint8Array, size: number, vary: boolean) {
  let at = 0
  let n = 0
  while (at < bytes.length) {
    // A view on the whole file, so the router is fed the aliased chunks a real
    // reader would produce rather than freshly allocated arrays.
    const len = vary ? 1 + ((n * 2654435761) % (size * 2)) : size
    const end = Math.min(bytes.length, at + len)
    yield bytes.subarray(at, end)
    at = end
    n++
  }
}

/** A small file, so the smallest chunk sizes are affordable to test. */
function synthetic (): Uint8Array {
  const value = (n: number, seed: number) =>
    Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) & 0xff)
  return writeBFast([
    { name: 'Empty', bytes: new Uint8Array(0) },
    { name: 'One', bytes: value(1, 3) },
    { name: 'AcrossChunks', bytes: value(5000, 7) },
    { name: 'Unaligned', bytes: value(63, 11) },
    { name: 'A name with spaces', bytes: value(300, 13) }
  ])
}

function run (path: string, source?: Uint8Array) {
  console.log(`\n=== ${source ? path : basename(path)} ===`)
  const file = source ?? readFileSync(path)
  const expected = readBFast(file.buffer as ArrayBuffer, file.byteOffset)
  const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength)
  console.log(`${(file.byteLength / 1048576).toFixed(3)} MB, ${expected.buffers.length} buffers`)

  for (const size of CHUNK_SIZES) {
    for (const vary of [false, true]) {
      // Very small chunks over a large file are far too slow to be useful.
      if (size < 4096 && file.byteLength > 4 * 1024 * 1024) continue

      const collected = new Map<string, Uint8Array>()
      const reader = new BFastStreamReader((range) => {
        const into = new Uint8Array(range.end - range.begin)
        collected.set(range.name, into)
        return memorySink(into)
      })
      for (const chunk of chunked(bytes, size, vary)) reader.push(chunk)
      reader.end()

      const label = `chunk ${size}${vary ? ' (varying)' : ''}`
      check(collected.size === expected.buffers.length,
        `${label}: routed ${collected.size} buffers, expected ${expected.buffers.length}`)
      for (const b of expected.buffers) {
        check(equal(collected.get(b.name) ?? new Uint8Array(0), b.bytes),
          `${label}: buffer "${b.name}" does not match`)
      }
    }
  }
  console.log('reassembly matches the whole-file reader at every chunk size')

  // Skipping a buffer must not disturb the others.
  const skipped = new Map<string, Uint8Array>()
  const wanted = expected.buffers.length > 1 ? expected.buffers[1].name : expected.buffers[0].name
  const readerSkip = new BFastStreamReader((range) => {
    if (range.name !== wanted) return undefined
    const into = new Uint8Array(range.end - range.begin)
    skipped.set(range.name, into)
    return memorySink(into)
  })
  for (const chunk of chunked(bytes, 1 << 20, false)) readerSkip.push(chunk)
  readerSkip.end()
  check(skipped.size === 1 && equal(skipped.get(wanted)!, expected.get(wanted)),
    `selecting only "${wanted}" did not produce it intact`)
  console.log(`selecting a single buffer ("${wanted}") works`)

  // A stream that stops inside the header must say so rather than half-load.
  let reported = false
  try {
    const truncated = new BFastStreamReader(() => undefined)
    truncated.push(bytes.subarray(0, 16))
    truncated.end()
  } catch (e) {
    reported = /before the BFAST header was complete/.test(String(e))
  }
  check(reported, 'a truncated stream did not report an incomplete header')
  console.log('a truncated stream is reported')
}

async function main () {
  const paths = process.argv.slice(2)
  run('synthetic', synthetic())
  for (const path of paths) run(path)

  // The async entry point should agree with pushing chunks by hand.
  const file = paths.length ? readFileSync(paths[0]) : synthetic()
  const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength)
  const collected = new Map<string, Uint8Array>()
  const ranges = await readBFastStream(
    (async function * () { for (const c of chunked(bytes, 1 << 20, false)) yield c })(),
    (range) => {
      const into = new Uint8Array(range.end - range.begin)
      collected.set(range.name, into)
      return memorySink(into)
    })
  const expected = readBFast(file.buffer as ArrayBuffer, file.byteOffset)
  check(ranges.length === expected.buffers.length &&
    expected.buffers.every((b) => equal(collected.get(b.name)!, b.bytes)),
  'readBFastStream did not agree with the whole-file reader')
  console.log('\nreadBFastStream agrees with the whole-file reader')

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
