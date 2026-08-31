/**
 * Culls one instance per invocation and appends the survivors' draw commands to
 * a compacted buffer. The atomic counters become the draw count that
 * `multiDrawIndexedIndirect` reads, so the CPU never learns how many instances
 * were visible.
 *
 * Two tests share the pass and each can be switched off from the host: the
 * frustum test rejects instances outside the view, and the contribution test
 * rejects instances whose bounding sphere projects to fewer than a given number
 * of pixels across.
 *
 * Opaque instances occupy the front of the instance range and transparent ones
 * the back, so each group compacts into its own half of the output buffer.
 */
export const cullShader = /* wgsl */ `
struct Cull {
  planes : array<vec4<f32>, 6>,
  info   : vec4<u32>,   // x: instance count, y: first transparent instance, z: 1 to frustum cull
  depth  : vec4<f32>,   // dot(xyz, p) + w is the view depth of the point p
  limits : vec4<f32>,   // x: pixels per world unit at unit depth, y: minimum diameter in pixels
};

@group(0) @binding(0) var<uniform> cull : Cull;
@group(0) @binding(1) var<storage, read> spheres : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source : array<u32>;
@group(0) @binding(3) var<storage, read_write> visible : array<u32>;
@group(0) @binding(4) var<storage, read_write> counts : array<atomic<u32>, 2>;

const WORDS : u32 = 5u;   // one DrawIndexedIndirect command

fn outsideFrustum(sphere : vec4<f32>) -> bool {
  for (var p = 0u; p < 6u; p = p + 1u) {
    let plane = cull.planes[p];
    if (dot(plane.xyz, sphere.xyz) + plane.w < -sphere.w) { return true; }
  }
  return false;
}

/// True when the sphere projects to less than the minimum diameter in pixels.
/// Spheres reaching the eye have no meaningful projected size, so they are kept.
fn tooSmall(sphere : vec4<f32>, minPixels : f32) -> bool {
  let depth = dot(cull.depth.xyz, sphere.xyz) + cull.depth.w;
  if (depth <= sphere.w) { return false; }
  return 2.0 * sphere.w * cull.limits.x / depth < minPixels;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= cull.info.x) { return; }

  let sphere = spheres[i];
  if (cull.info.z != 0u && outsideFrustum(sphere)) { return; }

  let minPixels = cull.limits.y;
  if (minPixels > 0.0 && tooSmall(sphere, minPixels)) { return; }

  let transparent = i >= cull.info.y;
  let slot = select(0u, 1u, transparent);
  let base = select(0u, cull.info.y, transparent);
  let out = base + atomicAdd(&counts[slot], 1u);

  for (var w = 0u; w < WORDS; w = w + 1u) {
    visible[out * WORDS + w] = source[i * WORDS + w];
  }
}
`
