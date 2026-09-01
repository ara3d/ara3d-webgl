import { GpuVertexFormat } from '../gpuVertices'

/**
 * Draws every instance of the model. `instance_index` picks the transform and
 * color, and it already includes the `firstInstance` field of the indirect
 * command, so one storage buffer serves every draw in a multi-draw call.
 *
 * Position components arrive either as scaled integers (BOS) or as floats
 * (BFAST), so the attribute type follows the scene's vertex format.
 */
export const sceneShader = (format: GpuVertexFormat) => {
  const t = format === 'sint32' ? 'i32' : 'f32'
  return /* wgsl */ `
struct Camera {
  viewProj : mat4x4<f32>,
  eye      : vec4<f32>,
  params   : vec4<f32>,   // x: vertex scale
};

// The three rows of a 3x4 transform, translation in each row's .w — the
// layout the model file uses. As a WGSL mat3x4 the rows land in the columns,
// so vec4 * rows yields the three row dot products: the world position.
struct Instance {
  rows  : mat3x4<f32>,
  color : vec4<f32>,
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
  @location(0) x : ${t},
  @location(1) y : ${t},
  @location(2) z : ${t}
) -> VsOut {
  let inst = instances[id];
  let local = vec3<f32>(f32(x), f32(y), f32(z)) * camera.params.x;
  let world = vec4<f32>(local, 1.0) * inst.rows;

  var out : VsOut;
  out.clip = camera.viewProj * vec4<f32>(world, 1.0);
  out.world = world;
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
}
