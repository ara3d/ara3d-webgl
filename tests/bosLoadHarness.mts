/**
 * Headless test and measurement harness for the .bos loader.
 * Runs the full load pipeline (unzip, parquet read, instances, geometry)
 * in Node, with no browser, and reports timings and model statistics.
 *
 * Usage (bundle first — hyparquet is ESM-only and the repo is CJS-typed,
 * so tsx cannot run this directly):
 *   npx esbuild tests/bosLoadHarness.mts --bundle --platform=node --format=cjs --outfile=out/bosHarness.cjs
 *   node out/bosHarness.cjs [path-to.bos ...]
 * With no arguments it loads the sample model in examples/public.
 */
import { readFileSync } from 'fs'
import { basename, resolve } from 'path'
import JSZip from 'jszip'
import * as THREE from 'three'
import { loadBimGeometryFromZip } from '../src/loader/bimOpenSchemaLoader'
import { buildInstances } from '../src/loader/buildInstances'
import { buildGeometry } from '../src/loader/buildGeometryGroup'

type StageTimings = Record<string, number>

async function timed<T> (timings: StageTimings, name: string, f: () => Promise<T> | T): Promise<T> {
  const start = performance.now()
  const result = await f()
  timings[name] = performance.now() - start
  return result
}

const mb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1) + ' MB'
const ms = (t: number) => t.toFixed(0) + ' ms'

async function loadAndMeasure (path: string) {
  console.log(`\n=== ${basename(path)} ===`)
  const timings: StageTimings = {}

  const buffer = await timed(timings, 'read file', () => readFileSync(path))
  console.log(`file size: ${mb(buffer.byteLength)}`)

  const zip = await timed(timings, 'open zip', () => JSZip.loadAsync(buffer))
  const bimData = await timed(timings, 'read parquet tables', () => loadBimGeometryFromZip(zip))
  const instances = await timed(timings, 'build instances', () => buildInstances(bimData.BimGeometry))
  const group = await timed(timings, 'build three geometry', () => buildGeometry(instances))
  const box = await timed(timings, 'compute bounds', () => new THREE.Box3().setFromObject(group))

  const bg = bimData.BimGeometry
  const visible = instances.filter((i) => i.visible).length
  const identity = instances.filter((i) => i.isIdentity).length
  let triangles = 0
  group.traverse((o) => {
    const g = (o as THREE.Mesh).geometry as THREE.BufferGeometry | undefined
    if (!g) return
    const count = g.index ? g.index.count : g.getAttribute('position')?.count ?? 0
    triangles += (count / 3) * ((o as THREE.InstancedMesh).count ?? 1)
  })

  console.log('\n--- timings ---')
  for (const [name, t] of Object.entries(timings)) console.log(`${name}: ${ms(t)}`)
  console.log(`total: ${ms(Object.values(timings).reduce((a, b) => a + b, 0))}`)

  console.log('\n--- tables ---')
  console.log(`vertices: ${bg.VertexX.length}`)
  console.log(`indices: ${bg.IndexBuffer.length}`)
  console.log(`meshes: ${bg.MeshVertexOffset.length}`)
  console.log(`materials: ${bg.MaterialAlpha.length}`)
  console.log(`transforms: ${bg.TransformTX.length}`)
  console.log(`instance rows: ${bg.InstanceMeshIndex.length}`)
  console.log(`entities: ${bimData.Entities?.EntityId?.length ?? 0}`)
  console.log(`strings: ${bimData.Strings?.length ?? 0}`)

  console.log('\n--- scene ---')
  console.log(`instances built: ${instances.length} (visible: ${visible}, identity transform: ${identity})`)
  console.log(`group children: ${group.children.length}`)
  console.log(`triangles (instanced): ${Math.round(triangles)}`)
  const size = box.getSize(new THREE.Vector3())
  const fmt = (v: THREE.Vector3) => `(${v.x.toFixed(1)}, ${v.y.toFixed(1)}, ${v.z.toFixed(1)})`
  console.log(`bounds min: ${fmt(box.min)} max: ${fmt(box.max)} size: ${fmt(size)}`)
  if (!isFinite(size.length())) console.log('WARNING: bounds are not finite')

  const mem = process.memoryUsage()
  console.log(`\nheap used: ${mb(mem.heapUsed)}, rss: ${mb(mem.rss)}`)
}

const defaults = [
  resolve('examples/public/Snowdon Towers Sample Architectural.bos')
]
const paths = process.argv.slice(2).length ? process.argv.slice(2) : defaults

async function main () {
  for (const path of paths) {
    await loadAndMeasure(path)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
