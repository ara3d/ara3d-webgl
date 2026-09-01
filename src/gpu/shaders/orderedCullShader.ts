import { cullCommon } from './cullShader'

/** Number of depth buckets the opaque commands are grouped into. */
export const ORDER_BUCKETS = 64

/**
 * The ordering variant of the cull pass: three entry points that compact the
 * surviving opaque draw commands grouped into depth buckets, nearest bucket
 * first, so the compacted buffer draws roughly front to back and early depth
 * testing rejects hidden fragments.
 *
 * `count` runs the cull tests once per instance, remembers the verdict, and
 * tallies each surviving opaque instance's bucket. `scan` turns the tallies
 * into start offsets and the opaque draw count. `scatter` re-reads the
 * verdicts and writes each surviving command into its bucket's slice.
 * Transparent survivors compact into their own half in arrival order, as in
 * the plain shader.
 */
export const orderedCullShader = cullCommon + /* wgsl */ `
const BUCKETS : u32 = ${ORDER_BUCKETS}u;
const CULLED : u32 = 0xffffffffu;
const TRANSPARENT : u32 = 0xfffffffeu;

@group(0) @binding(6) var<storage, read_write> buckets : array<atomic<u32>, BUCKETS>;
@group(0) @binding(7) var<storage, read_write> verdicts : array<u32>;

/// Buckets by the view depth of the sphere's nearest point, on a linear scale
/// from the nearest to the farthest corner of the scene bounds.
fn bucketOf(sphere : vec4<f32>) -> u32 {
  let d = dot(cull.depth.xyz, sphere.xyz) + cull.depth.w - sphere.w;
  return min(u32(max((d - cull.order.x) * cull.order.y, 0.0)), BUCKETS - 1u);
}

@compute @workgroup_size(64)
fn count(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= cull.info.x) { return; }
  let sphere = spheres[i];
  if (culled(sphere)) { verdicts[i] = CULLED; return; }
  if (i >= cull.info.y) { verdicts[i] = TRANSPARENT; return; }
  let b = bucketOf(sphere);
  verdicts[i] = b;
  atomicAdd(&buckets[b], 1u);
}

@compute @workgroup_size(1)
fn scan() {
  var sum = 0u;
  for (var b = 0u; b < BUCKETS; b = b + 1u) {
    let c = atomicLoad(&buckets[b]);
    atomicStore(&buckets[b], sum);
    sum = sum + c;
  }
  atomicStore(&counts[0], sum);
}

@compute @workgroup_size(64)
fn scatter(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= cull.info.x) { return; }
  let v = verdicts[i];
  if (v == CULLED) { return; }

  var out : u32;
  if (v == TRANSPARENT) {
    out = cull.info.y + atomicAdd(&counts[1], 1u);
  } else {
    out = atomicAdd(&buckets[v], 1u);
  }
  for (var w = 0u; w < WORDS; w = w + 1u) {
    visible[out * WORDS + w] = source[i * WORDS + w];
  }
}
`
