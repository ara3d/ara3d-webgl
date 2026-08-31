/**
 * Draws every instance of the model. `instance_index` picks the transform and
 * color, and it already includes the `firstInstance` field of the indirect
 * command, so one storage buffer serves every draw in a multi-draw call.
 */
export const sceneShader = /* wgsl */ `
struct Camera {
  viewProj : mat4x4<f32>,
  eye      : vec4<f32>,
  params   : vec4<f32>,   // x: vertex scale
};

struct Instance {
  transform : mat4x4<f32>,
  color     : vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera : Camera;
@group(0) @binding(1) var<storage, read> instances : array<Instance>;

struct VsOut {
  @builtin(position) clip  : vec4<f32>,
  @location(0)       world : vec3<f32>,
  @location(1)       color : vec4<f32>,
};

@vertex
fn vs(
  @builtin(instance_index) id : u32,
  @location(0) x : i32,
  @location(1) y : i32,
  @location(2) z : i32
) -> VsOut {
  let inst = instances[id];
  let local = vec3<f32>(f32(x), f32(y), f32(z)) * camera.params.x;
  let world = inst.transform * vec4<f32>(local, 1.0);

  var out : VsOut;
  out.clip = camera.viewProj * world;
  out.world = world.xyz;
  out.color = inst.color;
  return out;
}

const LIGHT_DIR = vec3<f32>(0.35, 0.45, 0.82);
const SKY_COLOR = vec3<f32>(0.72, 0.78, 0.88);
const GROUND_COLOR = vec3<f32>(0.28, 0.26, 0.24);

@fragment
fn fs(in : VsOut) -> @location(0) vec4<f32> {
  // Flat shading: the face normal comes from the screen space derivatives,
  // which keeps the vertex buffer down to raw positions.
  var n = normalize(cross(dpdx(in.world), dpdy(in.world)));
  let toEye = camera.eye.xyz - in.world;
  if (dot(n, toEye) < 0.0) { n = -n; }

  let hemi = mix(GROUND_COLOR, SKY_COLOR, n.z * 0.5 + 0.5);
  let diffuse = max(dot(n, normalize(LIGHT_DIR)), 0.0);
  let lit = in.color.rgb * (hemi * 0.55 + diffuse * 0.75);
  return vec4<f32>(lit, in.color.a);
}
`
