/**
 * Culls one instance per invocation and appends the survivors' draw commands to
 * a compacted buffer. The atomic counters become the draw count that
 * `multiDrawIndexedIndirect` reads, so the CPU never learns how many instances
 * were visible.
 *
 * Three tests share the pass and each can be switched off from the host: the
 * frustum test rejects instances outside the view, the contribution test
 * rejects instances whose bounding sphere projects to fewer than a given number
 * of pixels across, and the occlusion test rejects instances hidden behind the
 * depth pyramid built from the previous frame.
 *
 * Opaque instances occupy the front of the instance range and transparent ones
 * the back, so each group compacts into its own half of the output buffer.
 */

/**
 * The uniform, the shared bindings and the three tests, shared by this shader
 * and the ordered variant in `orderedCullShader.ts`.
 */
export const cullCommon = /* wgsl */ `
struct Cull {
  planes   : array<vec4<f32>, 6>,
  info     : vec4<u32>,   // x: instance count, y: first transparent instance,
                          // z: 1 to frustum cull, w: 1 to occlusion cull
  depth    : vec4<f32>,   // dot(xyz, p) + w is the view depth of the point p
  limits   : vec4<f32>,   // x: pixels per world unit at unit depth,
                          // y: minimum diameter in pixels, zw: pyramid mip 0 size
  viewProj : mat4x4<f32>,
  order    : vec4<f32>,   // x: view depth of the nearest scene corner,
                          // y: buckets per unit of view depth
};

@group(0) @binding(0) var<uniform> cull : Cull;
@group(0) @binding(1) var<storage, read> spheres : array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> source : array<u32>;
@group(0) @binding(3) var<storage, read_write> visible : array<u32>;
@group(0) @binding(4) var<storage, read_write> counts : array<atomic<u32>, 2>;
@group(0) @binding(5) var pyramid : texture_2d<f32>;

const WORDS : u32 = 5u;   // one DrawIndexedIndirect command

fn outsideFrustum(sphere : vec4<f32>) -> bool {
  for (var p = 0u; p < 6u; p = p + 1u) {
    let plane = cull.planes[p];
    if (dot(plane.xyz, sphere.xyz) + plane.w < -sphere.w) { return true; }
  }
  return false;
}

/// True when the sphere projects to less than the minimum diameter in pixels.
/// A centre at or behind the eye has no projected size, so it is kept; near the
/// eye the size grows without bound and passes on its own. In an orthographic
/// projection the depth row is constant 1, which makes the test exact.
fn tooSmall(sphere : vec4<f32>, minPixels : f32) -> bool {
  let depth = dot(cull.depth.xyz, sphere.xyz) + cull.depth.w;
  if (depth <= 0.0) { return false; }
  return 2.0 * sphere.w * cull.limits.x / depth < minPixels;
}

/// True when the sphere is hidden everywhere behind last frame's depth.
/// The sphere's world axis-aligned box is projected; because a projective map
/// carries a box in front of the eye to the convex hull of its corners, the
/// corner bounds enclose the sphere's footprint and nearest depth. The mip
/// where the rectangle spans at most one texel is tested with the 2x2 texels
/// that cover it, each holding the farthest depth beneath it.
fn occluded(sphere : vec4<f32>) -> bool {
  var minN = vec3<f32>(1e30);
  var maxN = vec3<f32>(-1e30);
  for (var c = 0u; c < 8u; c = c + 1u) {
    let corner = sphere.xyz + sphere.w * (vec3<f32>(
      f32(c & 1u), f32((c >> 1u) & 1u), f32((c >> 2u) & 1u)) * 2.0 - 1.0);
    let clip = cull.viewProj * vec4<f32>(corner, 1.0);
    if (clip.w <= 0.0) { return false; }   // reaches behind the eye: keep
    let ndc = clip.xyz / clip.w;
    minN = min(minN, ndc);
    maxN = max(maxN, ndc);
  }

  // NDC y points up, texture y points down.
  let size = cull.limits.zw;
  let lo = clamp(vec2<f32>(minN.x, -maxN.y) * 0.5 + 0.5, vec2<f32>(0.0), vec2<f32>(1.0)) * size;
  let hi = clamp(vec2<f32>(maxN.x, -minN.y) * 0.5 + 0.5, vec2<f32>(0.0), vec2<f32>(1.0)) * size;

  let extent = max(max(hi.x - lo.x, hi.y - lo.y), 1.0);
  let mips = f32(textureNumLevels(pyramid));
  let lod = clamp(ceil(log2(extent)), 0.0, mips - 1.0);
  let li = i32(lod);
  let lsize = max(vec2<i32>(size) >> vec2<u32>(u32(li)), vec2<i32>(1));
  let scale = exp2(-lod);
  let c0 = clamp(vec2<i32>(lo * scale), vec2<i32>(0), lsize - 1);
  let c1 = clamp(vec2<i32>(hi * scale), vec2<i32>(0), lsize - 1);

  let farthest = max(
    max(textureLoad(pyramid, c0, li).x, textureLoad(pyramid, vec2<i32>(c1.x, c0.y), li).x),
    max(textureLoad(pyramid, vec2<i32>(c0.x, c1.y), li).x, textureLoad(pyramid, c1, li).x));
  return clamp(minN.z, 0.0, 1.0) > farthest;
}

/// True when any enabled test rejects the sphere.
fn culled(sphere : vec4<f32>) -> bool {
  if (cull.info.z != 0u && outsideFrustum(sphere)) { return true; }
  let minPixels = cull.limits.y;
  if (minPixels > 0.0 && tooSmall(sphere, minPixels)) { return true; }
  if (cull.info.w != 0u && occluded(sphere)) { return true; }
  return false;
}
`

export const cullShader = cullCommon + /* wgsl */ `
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let i = gid.x;
  if (i >= cull.info.x) { return; }
  if (culled(spheres[i])) { return; }

  let transparent = i >= cull.info.y;
  let slot = select(0u, 1u, transparent);
  let base = select(0u, cull.info.y, transparent);
  let out = base + atomicAdd(&counts[slot], 1u);

  for (var w = 0u; w < WORDS; w = w + 1u) {
    visible[out * WORDS + w] = source[i * WORDS + w];
  }
}
`
