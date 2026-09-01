/**
 * Builds the hierarchical depth pyramid the occlusion test reads.
 * Every level stores the FARTHEST depth of the texels it covers, so a sphere
 * whose nearest point is farther than the stored value is hidden everywhere
 * under that texel — the conservative direction for culling. Depth is
 * reversed-Z (near 1, far 0), so the farthest depth is the minimum.
 */

/** Copies the depth buffer into pyramid mip 0, taking the farthest sample. */
export const hiZResolveShader = (samples: number) => {
  const src = samples > 1
    ? 'var src : texture_depth_multisampled_2d'
    : 'var src : texture_depth_2d'
  const load = samples > 1
    ? `var d = 1.0;
  for (var s = 0; s < ${samples}; s++) { d = min(d, textureLoad(src, p, s)); }`
    : 'let d = textureLoad(src, p, 0);'
  return /* wgsl */ `
@group(0) @binding(0) ${src};
@group(0) @binding(1) var dst : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let size = textureDimensions(dst);
  if (gid.x >= size.x || gid.y >= size.y) { return; }
  let p = vec2<i32>(gid.xy);
  ${load}
  textureStore(dst, p, vec4<f32>(d, 0.0, 0.0, 0.0));
}
`
}

/**
 * Halves one pyramid level into the next, keeping the farthest depth.
 * When the source has an odd size, the last destination row and column also
 * fold in the leftover source texels, so no depth is ever dropped.
 */
export const hiZDownsampleShader = /* wgsl */ `
@group(0) @binding(0) var src : texture_2d<f32>;
@group(0) @binding(1) var dst : texture_storage_2d<r32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let dsize = vec2<i32>(textureDimensions(dst));
  if (i32(gid.x) >= dsize.x || i32(gid.y) >= dsize.y) { return; }
  let ssize = vec2<i32>(textureDimensions(src));
  let base = vec2<i32>(gid.xy) * 2;
  let xEnd = select(min(base.x + 1, ssize.x - 1), ssize.x - 1, i32(gid.x) == dsize.x - 1);
  let yEnd = select(min(base.y + 1, ssize.y - 1), ssize.y - 1, i32(gid.y) == dsize.y - 1);

  var d = 1.0;
  for (var y = base.y; y <= yEnd; y++) {
    for (var x = base.x; x <= xEnd; x++) {
      d = min(d, textureLoad(src, vec2<i32>(x, y), 0).x);
    }
  }
  textureStore(dst, vec2<i32>(gid.xy), vec4<f32>(d, 0.0, 0.0, 0.0));
}
`
