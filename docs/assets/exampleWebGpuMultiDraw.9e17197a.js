var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import "./modulepreload-polyfill.c7c6310f.js";
import { c as columnVertices, a as cpuBytes, I as INSTANCE_FLOATS, D as DRAW_COMMAND_WORDS, b as buildGpuSceneFromTables, i as interleavedVertices, g as gpuBytes, d as buildGpuSceneFromModel, e as instanceCount, f as drawCount, r as requestGpuContext, h as instancedTriangleCount, m as meshTriangleCount, j as isWebGpuAvailable, M as MULTI_DRAW_HELP } from "./buildGpuSceneFromModel.e01cea5b.js";
import { s as Matrix4, a as Vector3, e_ as Quaternion, gb as JSZip, l as loadBimGeometryFromZip, F as Frustum, f_ as WebGPUCoordinateSystem, cJ as Box3 } from "./bimOpenSchemaLoader.69b9fd7e.js";
import { s as readRenderModelTables, R as RENDER_MODEL_BUFFERS, i as isBFast, d as readBFast, q as isRenderModel, t as readRenderModel, b as BFAST_HEADER_PROBE } from "./renderModel.76ea7852.js";
import { B as BFastStreamReader, m as memorySink, C as CameraControls } from "./bfastStream.5fe1e8fa.js";
function computeMeshSpheres(bg, vertexScale) {
  const { VertexX, VertexY, VertexZ, MeshVertexOffset } = bg;
  const meshCount = MeshVertexOffset.length;
  const vertexCount = VertexX.length;
  const spheres = new Float32Array(meshCount * 4);
  for (let m = 0; m < meshCount; m++) {
    const start = MeshVertexOffset[m];
    const end = m + 1 < meshCount ? MeshVertexOffset[m + 1] : vertexCount;
    if (end <= start)
      continue;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let v = start; v < end; v++) {
      const x = VertexX[v];
      const y = VertexY[v];
      const z = VertexZ[v];
      if (x < minX)
        minX = x;
      if (y < minY)
        minY = y;
      if (z < minZ)
        minZ = z;
      if (x > maxX)
        maxX = x;
      if (y > maxY)
        maxY = y;
      if (z > maxZ)
        maxZ = z;
    }
    const cx = (minX + maxX) * 0.5 * vertexScale;
    const cy = (minY + maxY) * 0.5 * vertexScale;
    const cz = (minZ + maxZ) * 0.5 * vertexScale;
    const hx = (maxX - minX) * 0.5 * vertexScale;
    const hy = (maxY - minY) * 0.5 * vertexScale;
    const hz = (maxZ - minZ) * 0.5 * vertexScale;
    spheres[m * 4 + 0] = cx;
    spheres[m * 4 + 1] = cy;
    spheres[m * 4 + 2] = cz;
    spheres[m * 4 + 3] = Math.sqrt(hx * hx + hy * hy + hz * hz);
  }
  return spheres;
}
const VERTEX_MULTIPLIER = 1e4;
function buildGpuScene(bg) {
  console.time("Building GPU scene");
  const vertexScale = 1 / VERTEX_MULTIPLIER;
  const meshCount = bg.MeshVertexOffset.length;
  const totalIndices = bg.IndexBuffer.length;
  const totalVertices = bg.VertexX.length;
  const meshSpheres = computeMeshSpheres(bg, vertexScale);
  const visible = collectVisibleInstances(bg);
  const n = visible.length;
  const instanceData = new Float32Array(n * INSTANCE_FLOATS);
  const instanceSpheres = new Float32Array(n * 4);
  const instanceIds = new Uint32Array(n);
  const drawCommands = new Uint32Array(n * DRAW_COMMAND_WORDS);
  const matrix2 = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const center = new Vector3();
  let triangleCount = 0;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let slot = 0; slot < n; slot++) {
    const i = visible[slot];
    const mesh = bg.InstanceMeshIndex[i];
    const t = bg.InstanceTransformIndex[i];
    const mat = bg.InstanceMaterialIndex[i];
    position.set(bg.TransformTX[t], bg.TransformTY[t], bg.TransformTZ[t]);
    quaternion.set(bg.TransformQX[t], bg.TransformQY[t], bg.TransformQZ[t], bg.TransformQW[t]);
    scale.set(bg.TransformSX[t], bg.TransformSY[t], bg.TransformSZ[t]);
    matrix2.compose(position, quaternion, scale);
    const base = slot * INSTANCE_FLOATS;
    instanceData.set(matrix2.elements, base);
    instanceData[base + 16] = bg.MaterialRed[mat] / 255;
    instanceData[base + 17] = bg.MaterialGreen[mat] / 255;
    instanceData[base + 18] = bg.MaterialBlue[mat] / 255;
    instanceData[base + 19] = bg.MaterialAlpha[mat] / 255;
    center.set(meshSpheres[mesh * 4], meshSpheres[mesh * 4 + 1], meshSpheres[mesh * 4 + 2]).applyMatrix4(matrix2);
    const radius = meshSpheres[mesh * 4 + 3] * maxAbs(scale);
    instanceSpheres[slot * 4 + 0] = center.x;
    instanceSpheres[slot * 4 + 1] = center.y;
    instanceSpheres[slot * 4 + 2] = center.z;
    instanceSpheres[slot * 4 + 3] = radius;
    minX = Math.min(minX, center.x - radius);
    maxX = Math.max(maxX, center.x + radius);
    minY = Math.min(minY, center.y - radius);
    maxY = Math.max(maxY, center.y + radius);
    minZ = Math.min(minZ, center.z - radius);
    maxZ = Math.max(maxZ, center.z + radius);
    const firstIndex = bg.MeshIndexOffset[mesh];
    const indexCount = (mesh + 1 < meshCount ? bg.MeshIndexOffset[mesh + 1] : totalIndices) - firstIndex;
    const cmd = slot * DRAW_COMMAND_WORDS;
    drawCommands[cmd + 0] = indexCount;
    drawCommands[cmd + 1] = 1;
    drawCommands[cmd + 2] = firstIndex;
    drawCommands[cmd + 3] = bg.MeshVertexOffset[mesh];
    drawCommands[cmd + 4] = slot;
    instanceIds[slot] = i;
    triangleCount += indexCount / 3;
  }
  const opaqueCount = countOpaque(instanceData, n);
  const scene = {
    vertices: columnVertices(bg.VertexX, bg.VertexY, bg.VertexZ, vertexScale),
    indices: cpuBytes(new Uint32Array(bg.IndexBuffer.buffer, bg.IndexBuffer.byteOffset, totalIndices)),
    instanceData,
    instanceSpheres,
    instanceIds,
    drawCommands,
    opaque: { first: 0, count: opaqueCount },
    transparent: { first: opaqueCount, count: n - opaqueCount },
    triangleCount,
    boundsMin: [minX, minY, minZ],
    boundsMax: [maxX, maxY, maxZ]
  };
  console.timeEnd("Building GPU scene");
  console.log(
    `GPU scene: ${n} draws, ${triangleCount} triangles, ${totalVertices} vertices`
  );
  return scene;
}
const maxAbs = (v) => Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z));
function collectVisibleInstances(bg) {
  const count = bg.InstanceMeshIndex.length;
  const opaque = [];
  const transparent = [];
  for (let i = 0; i < count; i++) {
    const mesh = bg.InstanceMeshIndex[i];
    if (mesh < 0)
      continue;
    if (bg.InstanceFlags[i] & 1)
      continue;
    const meshCount = bg.MeshVertexOffset.length;
    const firstIndex = bg.MeshIndexOffset[mesh];
    const nextIndex = mesh + 1 < meshCount ? bg.MeshIndexOffset[mesh + 1] : bg.IndexBuffer.length;
    if (nextIndex <= firstIndex)
      continue;
    const alpha = bg.MaterialAlpha[bg.InstanceMaterialIndex[i]];
    (alpha < 255 ? transparent : opaque).push(i);
  }
  return Int32Array.from(opaque.concat(transparent));
}
const countOpaque = (instanceData, n) => {
  let count = 0;
  while (count < n && instanceData[count * INSTANCE_FLOATS + 19] >= 1)
    count++;
  return count;
};
function gpuBufferSink(device, buffer) {
  let at = 0;
  let carry = new Uint8Array(0);
  return {
    write(bytes, offset) {
      if (offset !== at + carry.length) {
        throw new Error(`GPU sink expected offset ${at + carry.length} but got ${offset}.`);
      }
      let data = bytes;
      if (carry.length) {
        const joined = new Uint8Array(carry.length + bytes.length);
        joined.set(carry);
        joined.set(bytes, carry.length);
        data = joined;
      }
      const whole = data.length & ~3;
      carry = data.slice(whole);
      if (whole === 0)
        return;
      device.queue.writeBuffer(buffer, at, data.buffer, data.byteOffset, whole);
      at += whole;
    },
    end() {
      if (carry.length === 0)
        return;
      const padded = new Uint8Array(4);
      padded.set(carry);
      device.queue.writeBuffer(buffer, at, padded);
      at += carry.length;
      carry = new Uint8Array(0);
    }
  };
}
function createBuffer(device, data, usage, label) {
  const buffer = device.createBuffer({
    label,
    size: align4(data.byteLength),
    usage: usage | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
  return buffer;
}
const createEmptyBuffer = (device, size, usage, label) => device.createBuffer({ label, size: align4(size), usage });
const align4 = (n) => n + 3 & ~3;
const toGpuBuffer = (device, bytes, usage, label) => bytes.kind === "gpu" ? bytes.gpuBuffer : createBuffer(device, bytes.data, usage, label);
async function streamGpuScene(device, chunks) {
  const B = RENDER_MODEL_BUFFERS;
  const usage = {
    [B.vertices]: GPUBufferUsage.VERTEX,
    [B.indices]: GPUBufferUsage.INDEX
  };
  const uploaded = /* @__PURE__ */ new Map();
  const tables = /* @__PURE__ */ new Map();
  const sinkFor = (range) => {
    const size = range.end - range.begin;
    const geometry = usage[range.name];
    if (geometry !== void 0) {
      const buffer = device.createBuffer({
        label: range.name,
        size: align4(size),
        usage: geometry | GPUBufferUsage.COPY_DST
      });
      uploaded.set(range.name, { buffer, byteLength: size });
      return gpuBufferSink(device, buffer);
    }
    const bytes = new Uint8Array(size);
    tables.set(range.name, bytes);
    return memorySink(bytes);
  };
  const reader = new BFastStreamReader(sinkFor);
  try {
    for await (const chunk of chunks)
      reader.push(chunk);
    reader.end();
    const model = readRenderModelTables((name) => {
      const bytes = tables.get(name);
      if (!bytes) {
        throw new Error(
          `The stream has no buffer named "${name}". Found: ${found(reader.ranges)}`
        );
      }
      return bytes;
    });
    const vertices = need(uploaded, B.vertices, reader.ranges);
    const indices = need(uploaded, B.indices, reader.ranges);
    return buildGpuSceneFromTables(
      model,
      interleavedVertices(gpuBytes(vertices.buffer, vertices.byteLength), model.floatsPerVertex),
      gpuBytes(indices.buffer, indices.byteLength)
    );
  } catch (e) {
    for (const { buffer } of uploaded.values())
      buffer.destroy();
    throw e;
  }
}
const found = (ranges) => ranges ? ranges.map((r) => r.name).join(", ") : "nothing, the header was never read";
function need(uploaded, name, ranges) {
  const found_ = uploaded.get(name);
  if (!found_) {
    throw new Error(`The stream has no buffer named "${name}". Found: ${found(ranges)}`);
  }
  return found_;
}
async function* streamChunks(reader, prefix = []) {
  for (const p of prefix)
    yield p;
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done)
      return;
    if (value)
      yield value;
  }
}
class GpuModelLoader {
  constructor(options = {}) {
    __publicField(this, "options");
    this.options = options;
  }
  async load(source) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch model from ${source}: ${response.status} ${response.statusText}`);
    }
    const device = this.options.device;
    if (device && response.body) {
      return await loadFromStream(device, response.body.getReader());
    }
    return this.loadFromArrayBuffer(await response.arrayBuffer());
  }
  async loadFromFile(file) {
    const device = this.options.device;
    if (device && typeof file.stream === "function") {
      return await loadFromStream(device, file.stream().getReader());
    }
    return this.loadFromArrayBuffer(await file.arrayBuffer());
  }
  async loadFromArrayBuffer(buffer) {
    return isBFast(buffer) ? { scene: loadBFastScene(buffer) } : await loadBosModel(buffer);
  }
}
async function loadFromStream(device, reader) {
  const { chunks, bytes, done } = await readAtLeast(reader, BFAST_HEADER_PROBE);
  const head = concat(chunks, bytes);
  if (isBFast(head.buffer, head.byteOffset)) {
    return { scene: await streamGpuScene(device, streamChunks(reader, [head])) };
  }
  const rest = done ? [] : (await readAll(reader)).chunks;
  const whole = concat([head, ...rest], bytes + total(rest));
  return await loadBosModel(whole.buffer);
}
async function readAtLeast(reader, wanted) {
  const chunks = [];
  let bytes = 0;
  while (bytes < wanted) {
    const { done, value } = await reader.read();
    if (done)
      return { chunks, bytes, done: true };
    if (value) {
      chunks.push(value);
      bytes += value.length;
    }
  }
  return { chunks, bytes, done: false };
}
async function readAll(reader) {
  const chunks = [];
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done)
      return { chunks };
    if (value)
      chunks.push(value);
  }
}
const total = (chunks) => chunks.reduce((n, c) => n + c.length, 0);
const concat = (chunks, bytes) => {
  const out = new Uint8Array(bytes);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
};
function loadBFastScene(buffer) {
  const bfast = readBFast(buffer);
  if (!isRenderModel(bfast)) {
    throw new Error(
      `This BFAST is not a render model. It contains: ${bfast.names.join(", ")}`
    );
  }
  return buildGpuSceneFromModel(readRenderModel(bfast));
}
async function loadBosModel(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const bim = await loadBimGeometryFromZip(zip);
  return { bim, scene: buildGpuScene(bim.BimGeometry) };
}
const GPU_MODEL_EXTENSIONS = [".bos", ".bfast"];
const isGpuModelFile = (name) => GPU_MODEL_EXTENSIONS.some((e) => name.toLowerCase().endsWith(e));
const cullShader = `
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
/// A centre at or behind the eye has no projected size, so it is kept; near the
/// eye the size grows without bound and passes on its own. In an orthographic
/// projection the depth row is constant 1, which makes the test exact.
fn tooSmall(sphere : vec4<f32>, minPixels : f32) -> bool {
  let depth = dot(cull.depth.xyz, sphere.xyz) + cull.depth.w;
  if (depth <= 0.0) { return false; }
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
`;
const frustum = new Frustum();
const matrix = new Matrix4();
function writeFrustumPlanes(viewProj, out) {
  matrix.copy(viewProj);
  frustum.setFromProjectionMatrix(matrix, WebGPUCoordinateSystem);
  for (let i = 0; i < 6; i++) {
    const plane = frustum.planes[i];
    out[i * 4 + 0] = plane.normal.x;
    out[i * 4 + 1] = plane.normal.y;
    out[i * 4 + 2] = plane.normal.z;
    out[i * 4 + 3] = plane.constant;
  }
  return out;
}
function pixelsPerUnitAtUnitDepth(viewProj, height) {
  const e = viewProj.elements;
  return 0.5 * height * Math.hypot(e[1], e[5], e[9]);
}
function writeDepthPlane(viewProj, out, offset) {
  const e = viewProj.elements;
  out[offset + 0] = e[3];
  out[offset + 1] = e[7];
  out[offset + 2] = e[11];
  out[offset + 3] = e[15];
  return out;
}
const CULL_UNIFORM_BYTES = 144;
const DEPTH_PLANE_FLOAT = 28;
const LIMITS_FLOAT = 32;
const WORKGROUP_SIZE = 64;
const COUNTS_BYTES = 8;
const OPAQUE_COUNT_OFFSET = 0;
const TRANSPARENT_COUNT_OFFSET = 4;
class GpuCuller {
  constructor(device, scene, source) {
    __publicField(this, "visible");
    __publicField(this, "counts");
    __publicField(this, "device");
    __publicField(this, "pipeline");
    __publicField(this, "bindGroup");
    __publicField(this, "uniform");
    __publicField(this, "uniformData", new Float32Array(CULL_UNIFORM_BYTES / 4));
    __publicField(this, "info");
    __publicField(this, "zeros", new Uint32Array(COUNTS_BYTES / 4));
    __publicField(this, "spheres");
    __publicField(this, "readback");
    __publicField(this, "groups");
    __publicField(this, "reading", false);
    __publicField(this, "lastCounts", [0, 0]);
    this.device = device;
    const n = instanceCount(scene);
    this.groups = Math.ceil(n / WORKGROUP_SIZE);
    this.spheres = createBuffer(device, scene.instanceSpheres, GPUBufferUsage.STORAGE, "spheres");
    this.visible = createEmptyBuffer(
      device,
      scene.drawCommands.byteLength,
      GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE,
      "visibleCommands"
    );
    this.counts = createEmptyBuffer(
      device,
      COUNTS_BYTES,
      GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      "drawCounts"
    );
    this.readback = createEmptyBuffer(
      device,
      COUNTS_BYTES,
      GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      "countsReadback"
    );
    this.uniform = createEmptyBuffer(
      device,
      CULL_UNIFORM_BYTES,
      GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      "cullUniform"
    );
    this.info = new Uint32Array(this.uniformData.buffer, 96, 4);
    this.info[0] = n;
    this.info[1] = scene.transparent.first;
    this.pipeline = device.createComputePipeline({
      label: "cull",
      layout: "auto",
      compute: { module: device.createShaderModule({ label: "cull", code: cullShader }), entryPoint: "main" }
    });
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniform } },
        { binding: 1, resource: { buffer: this.spheres } },
        { binding: 2, resource: { buffer: source } },
        { binding: 3, resource: { buffer: this.visible } },
        { binding: 4, resource: { buffer: this.counts } }
      ]
    });
  }
  cull(encoder, viewProj, params) {
    writeFrustumPlanes(viewProj, this.uniformData);
    writeDepthPlane(viewProj, this.uniformData, DEPTH_PLANE_FLOAT);
    this.info[2] = params.frustum ? 1 : 0;
    this.uniformData[LIMITS_FLOAT] = pixelsPerUnitAtUnitDepth(viewProj, params.viewportHeight);
    this.uniformData[LIMITS_FLOAT + 1] = params.minPixels;
    this.device.queue.writeBuffer(this.uniform, 0, this.uniformData);
    this.device.queue.writeBuffer(this.counts, 0, this.zeros);
    const pass = encoder.beginComputePass({ label: "cull" });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.dispatchWorkgroups(this.groups);
    pass.end();
    if (!this.reading)
      encoder.copyBufferToBuffer(this.counts, 0, this.readback, 0, COUNTS_BYTES);
  }
  get drawnCounts() {
    return this.lastCounts;
  }
  pollCounts() {
    if (this.reading)
      return;
    this.reading = true;
    this.readback.mapAsync(GPUMapMode.READ).then(() => {
      const view = new Uint32Array(this.readback.getMappedRange().slice(0));
      this.lastCounts = [view[0], view[1]];
      this.readback.unmap();
      this.reading = false;
    }).catch(() => {
      this.reading = false;
    });
  }
  dispose() {
    for (const b of [this.spheres, this.visible, this.counts, this.readback, this.uniform]) {
      b.destroy();
    }
  }
}
function selectLargestDraws(scene, limit) {
  const n = drawCount(scene);
  if (n <= limit) {
    return { commands: scene.drawCommands, opaque: scene.opaque, transparent: scene.transparent };
  }
  const radius = (slot) => scene.instanceSpheres[slot * 4 + 3];
  const threshold = radiusThreshold(scene, n, limit);
  const selected = [];
  for (let slot = 0; slot < n; slot++) {
    if (radius(slot) > threshold)
      selected.push(slot);
  }
  for (let slot = 0; slot < n && selected.length < limit; slot++) {
    if (radius(slot) === threshold)
      selected.push(slot);
  }
  selected.sort((a, b) => a - b);
  const commands = new Uint32Array(selected.length * DRAW_COMMAND_WORDS);
  for (let i = 0; i < selected.length; i++) {
    const from = selected[i] * DRAW_COMMAND_WORDS;
    for (let w = 0; w < DRAW_COMMAND_WORDS; w++) {
      commands[i * DRAW_COMMAND_WORDS + w] = scene.drawCommands[from + w];
    }
  }
  const firstTransparent = scene.transparent.first;
  let opaqueCount = 0;
  while (opaqueCount < selected.length && selected[opaqueCount] < firstTransparent)
    opaqueCount++;
  return {
    commands,
    opaque: { first: 0, count: opaqueCount },
    transparent: { first: opaqueCount, count: selected.length - opaqueCount }
  };
}
function radiusThreshold(scene, n, limit) {
  const radii = new Float32Array(n);
  for (let slot = 0; slot < n; slot++)
    radii[slot] = scene.instanceSpheres[slot * 4 + 3];
  radii.sort();
  return radii[n - limit];
}
const sceneShader = (format) => {
  const t = format === "sint32" ? "i32" : "f32";
  return `
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
  @location(0) x : ${t},
  @location(1) y : ${t},
  @location(2) z : ${t}
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
`;
};
const CAMERA_BYTES = 96;
const SAMPLE_COUNT = 4;
class GpuRenderer {
  constructor(canvas, ctx) {
    __publicField(this, "canvas");
    __publicField(this, "ctx");
    __publicField(this, "context");
    __publicField(this, "format");
    __publicField(this, "cameraBuffer");
    __publicField(this, "cameraData", new Float32Array(CAMERA_BYTES / 4));
    __publicField(this, "layout");
    __publicField(this, "pipelineCache", /* @__PURE__ */ new Map());
    __publicField(this, "resources");
    __publicField(this, "depth");
    __publicField(this, "color");
    __publicField(this, "width", 0);
    __publicField(this, "height", 0);
    __publicField(this, "useMultiDraw");
    __publicField(this, "culling", false);
    __publicField(this, "contributionCulling", false);
    __publicField(this, "contributionThreshold", 0.1);
    __publicField(this, "maxFallbackDraws", 5e4);
    this.canvas = canvas;
    this.ctx = ctx;
    this.useMultiDraw = ctx.multiDraw;
    const context = canvas.getContext("webgpu");
    if (!context)
      throw new Error("Could not create a WebGPU canvas context.");
    this.context = context;
    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({ device: ctx.device, format: this.format, alphaMode: "opaque" });
    this.cameraBuffer = ctx.device.createBuffer({
      label: "camera",
      size: CAMERA_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    this.layout = ctx.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: "uniform" }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: "read-only-storage" }
        }
      ]
    });
  }
  getPipelines(vertices) {
    const key = pipelineKey(vertices);
    const cached = this.pipelineCache.get(key);
    if (cached)
      return cached;
    const module = this.ctx.device.createShaderModule({
      label: "scene",
      code: sceneShader(vertices.format)
    });
    const pipelines = {
      opaque: this.createPipeline(module, vertices, false),
      transparent: this.createPipeline(module, vertices, true)
    };
    this.pipelineCache.set(key, pipelines);
    return pipelines;
  }
  createPipeline(module, vertices, transparent) {
    return this.ctx.device.createRenderPipeline({
      label: transparent ? "transparent" : "opaque",
      layout: this.ctx.device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
      vertex: {
        module,
        entryPoint: "vs",
        buffers: vertexLayouts(vertices)
      },
      fragment: {
        module,
        entryPoint: "fs",
        targets: [{
          format: this.format,
          blend: transparent ? BLEND_OVER : void 0
        }]
      },
      primitive: { topology: "triangle-list", cullMode: "none" },
      depthStencil: {
        format: "depth24plus",
        depthWriteEnabled: !transparent,
        depthCompare: "less"
      },
      multisample: { count: SAMPLE_COUNT }
    });
  }
  setScene(scene) {
    console.time("Uploading GPU buffers");
    const device = this.ctx.device;
    this.releaseScene();
    const vertexBuffers = scene.vertices.buffers.map((b, i) => toGpuBuffer(device, b.bytes, GPUBufferUsage.VERTEX, `vertices${i}`));
    const indices = toGpuBuffer(device, scene.indices, GPUBufferUsage.INDEX, "indices");
    const instances = createBuffer(device, scene.instanceData, GPUBufferUsage.STORAGE, "instances");
    const indirect = createBuffer(
      device,
      scene.drawCommands,
      GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE,
      "indirect"
    );
    const bindGroup = device.createBindGroup({
      layout: this.layout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: { buffer: instances } }
      ]
    });
    const culler = new GpuCuller(device, scene, indirect);
    this.resources = {
      scene,
      vertexBuffers,
      indices,
      instances,
      indirect,
      fallback: this.createFallback(scene),
      bindGroup,
      culler,
      pipelines: this.getPipelines(scene.vertices)
    };
    console.timeEnd("Uploading GPU buffers");
  }
  createFallback(scene) {
    if (drawCount(scene) <= this.maxFallbackDraws)
      return void 0;
    const draws = selectLargestDraws(scene, this.maxFallbackDraws);
    const indirect = createBuffer(
      this.ctx.device,
      draws.commands,
      GPUBufferUsage.INDIRECT,
      "indirect fallback"
    );
    return { indirect, opaque: draws.opaque, transparent: draws.transparent };
  }
  get drawCount() {
    return this.resources ? drawCount(this.resources.scene) : 0;
  }
  get fallbackActive() {
    return !!this.resources?.fallback && !(this.useMultiDraw && this.ctx.multiDraw);
  }
  get cullingActive() {
    return (this.culling || this.contributionCulling) && this.useMultiDraw && this.ctx.multiDraw;
  }
  get drawnCount() {
    if (!this.resources)
      return 0;
    const fallback = this.fallbackActive ? this.resources.fallback : void 0;
    if (fallback)
      return fallback.opaque.count + fallback.transparent.count;
    if (!this.cullingActive)
      return this.drawCount;
    const [opaque, transparent] = this.resources.culler.drawnCounts;
    return opaque + transparent;
  }
  render(viewProj, eye) {
    const r = this.resources;
    if (!r)
      return;
    this.resize();
    this.updateCamera(viewProj, eye, r.scene.vertices.scale);
    const encoder = this.ctx.device.createCommandEncoder();
    const culler = this.cullingActive ? r.culler : void 0;
    culler?.cull(encoder, viewProj, {
      frustum: this.culling,
      minPixels: this.contributionCulling ? this.contributionThreshold : 0,
      viewportHeight: Math.max(1, this.canvas.clientHeight)
    });
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.color.createView(),
        resolveTarget: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.09, g: 0.1, b: 0.12, a: 1 },
        loadOp: "clear",
        storeOp: "discard"
      }],
      depthStencilAttachment: {
        view: this.depth.createView(),
        depthClearValue: 1,
        depthLoadOp: "clear",
        depthStoreOp: "discard"
      }
    });
    pass.setBindGroup(0, r.bindGroup);
    r.vertexBuffers.forEach((b, i) => pass.setVertexBuffer(i, b));
    pass.setIndexBuffer(r.indices, "uint32");
    const fallback = this.fallbackActive ? r.fallback : void 0;
    const ranges = fallback ?? r.scene;
    const indirect = culler ? culler.visible : fallback ? fallback.indirect : r.indirect;
    pass.setPipeline(r.pipelines.opaque);
    this.drawRange(pass, indirect, ranges.opaque, culler?.counts, OPAQUE_COUNT_OFFSET);
    pass.setPipeline(r.pipelines.transparent);
    this.drawRange(pass, indirect, ranges.transparent, culler?.counts, TRANSPARENT_COUNT_OFFSET);
    pass.end();
    this.ctx.device.queue.submit([encoder.finish()]);
    culler?.pollCounts();
  }
  drawRange(pass, indirect, range, counts, countOffset) {
    if (range.count === 0)
      return;
    const stride = DRAW_COMMAND_WORDS * 4;
    const offset = range.first * stride;
    if (this.useMultiDraw && this.ctx.multiDraw) {
      pass.multiDrawIndexedIndirect(indirect, offset, range.count, counts, countOffset);
      return;
    }
    for (let i = 0; i < range.count; i++) {
      pass.drawIndexedIndirect(indirect, offset + i * stride);
    }
  }
  updateCamera(viewProj, eye, vertexScale) {
    this.cameraData.set(viewProj.elements, 0);
    this.cameraData[16] = eye.x;
    this.cameraData[17] = eye.y;
    this.cameraData[18] = eye.z;
    this.cameraData[20] = vertexScale;
    this.ctx.device.queue.writeBuffer(this.cameraBuffer, 0, this.cameraData);
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));
    if (width === this.width && height === this.height && this.depth)
      return;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    this.depth?.destroy();
    this.color?.destroy();
    this.depth = this.ctx.device.createTexture({
      size: [width, height],
      format: "depth24plus",
      sampleCount: SAMPLE_COUNT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
    this.color = this.ctx.device.createTexture({
      size: [width, height],
      format: this.format,
      sampleCount: SAMPLE_COUNT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    });
  }
  get aspect() {
    return this.width / Math.max(this.height, 1);
  }
  releaseScene() {
    const r = this.resources;
    if (!r)
      return;
    r.culler.dispose();
    const owned = [...r.vertexBuffers, r.indices, r.instances, r.indirect];
    if (r.fallback)
      owned.push(r.fallback.indirect);
    for (const b of owned)
      b.destroy();
    this.resources = void 0;
  }
  dispose() {
    this.releaseScene();
    this.depth?.destroy();
    this.color?.destroy();
    this.cameraBuffer.destroy();
  }
}
const vertexLayouts = (v) => v.buffers.map((b) => ({
  arrayStride: b.stride,
  attributes: b.attributes.map((a) => ({ ...a, format: v.format }))
}));
const pipelineKey = (v) => v.format + "|" + JSON.stringify(v.buffers.map((b) => [b.stride, b.attributes]));
const BLEND_OVER = {
  color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
};
const Z_UP_TO_Y_UP = new Matrix4().makeRotationX(-Math.PI / 2);
const Y_UP_TO_Z_UP = new Matrix4().makeRotationX(Math.PI / 2);
const toCameraSpace = (box) => box.clone().applyMatrix4(Z_UP_TO_Y_UP);
function useWebGpuProjection(camera) {
  const cameras = [camera.camPerspective.camera, camera.camOrthographic.camera];
  for (const c of cameras) {
    c.coordinateSystem = WebGPUCoordinateSystem;
    c.updateProjectionMatrix();
  }
}
function modelViewProjection(camera, out = new Matrix4()) {
  const three = camera.three;
  three.updateMatrixWorld(true);
  return out.multiplyMatrices(three.projectionMatrix, three.matrixWorldInverse).multiply(Z_UP_TO_Y_UP);
}
const modelEye = (camera, out = new Vector3()) => out.copy(camera.position).applyMatrix4(Y_UP_TO_Z_UP);
const stallReason = (idleMs) => document.hidden ? "paused: page is not visible" : `paused: no frames for ${(idleMs / 1e3).toFixed(1)}s`;
const WATCHDOG_INTERVAL_MS = 1e3;
const STALL_MS = 2e3;
class GpuViewer {
  constructor(canvas, ctx) {
    __publicField(this, "renderer");
    __publicField(this, "controls");
    __publicField(this, "onFrame");
    __publicField(this, "onStopped");
    __publicField(this, "onStalled");
    __publicField(this, "running", false);
    __publicField(this, "frames", 0);
    __publicField(this, "frameStart", 0);
    __publicField(this, "cpuMs", 0);
    __publicField(this, "triangles", 0);
    __publicField(this, "meshTriangles", 0);
    __publicField(this, "lastFrameAt", 0);
    __publicField(this, "lastUpdateAt", 0);
    __publicField(this, "stalled", false);
    __publicField(this, "watchdog");
    __publicField(this, "viewProj", new Matrix4());
    __publicField(this, "eye", new Vector3());
    __publicField(this, "checkStalled", () => {
      const idle = performance.now() - this.lastFrameAt;
      const stalled = this.running && idle > STALL_MS;
      if (stalled === this.stalled)
        return;
      this.stalled = stalled;
      this.onStalled?.(stalled ? stallReason(idle) : void 0);
    });
    __publicField(this, "loop", () => {
      if (!this.running)
        return;
      const now = performance.now();
      this.controls.update(Math.min((now - this.lastUpdateAt) / 1e3, 0.1));
      this.lastUpdateAt = now;
      const t0 = performance.now();
      try {
        this.renderer.render(
          modelViewProjection(this.camera, this.viewProj),
          modelEye(this.camera, this.eye)
        );
      } catch (e) {
        this.fail("Rendering stopped: " + (e.message ?? e));
        return;
      }
      this.cpuMs += performance.now() - t0;
      this.frames++;
      this.lastFrameAt = performance.now();
      const elapsed = performance.now() - this.frameStart;
      if (elapsed > 500 && this.onFrame) {
        this.onFrame({
          fps: this.frames * 1e3 / elapsed,
          cpuMs: this.cpuMs / this.frames,
          drawCommands: this.renderer.drawCount,
          drawnCommands: this.renderer.drawnCount,
          triangles: this.triangles,
          meshTriangles: this.meshTriangles,
          multiDraw: this.renderer.useMultiDraw && this.context.multiDraw,
          culling: this.renderer.cullingActive
        });
        this.frames = 0;
        this.cpuMs = 0;
        this.frameStart = performance.now();
      }
      requestAnimationFrame(this.loop);
    });
    this.renderer = new GpuRenderer(canvas, ctx);
    this.controls = new CameraControls(canvas);
    useWebGpuProjection(this.controls.camera);
    ctx.lost.then((info) => this.fail(`WebGPU device lost (${info.reason}): ${info.message}`));
  }
  get camera() {
    return this.controls.camera;
  }
  fail(reason) {
    if (!this.running)
      return;
    this.running = false;
    console.error(reason);
    this.onStopped?.(reason);
  }
  static async create(canvas) {
    return new GpuViewer(canvas, await requestGpuContext());
  }
  get context() {
    return this.renderer.ctx;
  }
  setScene(scene) {
    this.renderer.setScene(scene);
    this.triangles = instancedTriangleCount(scene);
    this.meshTriangles = meshTriangleCount(scene);
    const bounds = toCameraSpace(new Box3(
      new Vector3().fromArray(scene.boundsMin),
      new Vector3().fromArray(scene.boundsMax)
    ));
    const radius = Math.max(bounds.getSize(new Vector3()).length() * 0.5, 1e-3);
    this.controls.setClipPlanes(Math.max(radius / 2e3, 1e-3), radius * 50);
    this.controls.frame(bounds);
    console.log(`Scene has ${instanceCount(scene)} instances`);
  }
  start() {
    if (this.running)
      return;
    this.running = true;
    this.frameStart = performance.now();
    this.lastFrameAt = performance.now();
    this.lastUpdateAt = performance.now();
    this.watchdog = setInterval(this.checkStalled, WATCHDOG_INTERVAL_MS);
    requestAnimationFrame(this.loop);
  }
  stop() {
    this.running = false;
    clearInterval(this.watchdog);
    this.watchdog = void 0;
  }
  dispose() {
    this.stop();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
const STYLE = `
.gpu-page { position: fixed; inset: 0; background: #16181c; }
.gpu-canvas { width: 100%; height: 100%; display: block; touch-action: none; outline: none; }
.gpu-panel {
  position: absolute; top: 12px; left: 12px; padding: 12px 14px;
  font: 12px/1.5 ui-monospace, Consolas, monospace; color: #e8ecf2;
  background: rgba(20, 22, 26, 0.82); border: 1px solid #333a44; border-radius: 6px;
  min-width: 280px; pointer-events: auto;
}
.gpu-panel h2 {
  font-size: 13px; margin: 0; color: #9fd0ff; font-weight: 600;
  display: flex; justify-content: space-between; align-items: center; gap: 10px;
}
.gpu-panel.open h2 { margin-bottom: 8px; }
.gpu-rollup {
  font: inherit; color: #9aa4b2; background: none; border: 1px solid #333a44;
  border-radius: 4px; width: 22px; height: 22px; cursor: pointer; line-height: 1;
}
.gpu-rollup:hover { color: #e8ecf2; border-color: #55606e; }
.gpu-row { display: flex; justify-content: space-between; gap: 16px; }
.gpu-row span:last-child { color: #ffd479; }
.gpu-note { margin-top: 8px; color: #9aa4b2; }
.gpu-note.bad { color: #ff8f8f; }
.gpu-toggle { margin-top: 10px; display: flex; align-items: center; gap: 6px; color: #cbd4e1; }
.gpu-slider { margin-top: 6px; display: flex; align-items: center; gap: 8px; color: #cbd4e1; }
.gpu-slider input { flex: 1; }
.gpu-slider span { color: #ffd479; min-width: 56px; text-align: right; }
`;
const MAX_THRESHOLD_PX = 4;
const sliderToPixels = (position) => Math.round(MAX_THRESHOLD_PX * Math.pow(position / 1e3, 3) * 1e3) / 1e3;
const pixelsToSlider = (px) => Math.round(1e3 * Math.cbrt(px / MAX_THRESHOLD_PX));
const ROWS = [
  ["adapter", "Adapter"],
  ["status", "Multi-draw"],
  ["draws", "Draw commands"],
  ["drawn", "Submitted"],
  ["meshtris", "Mesh triangles"],
  ["tris", "Triangles (all instances)"],
  ["fps", "FPS"],
  ["cpu", "CPU ms / frame"]
];
function createGpuPanel() {
  const style = document.createElement("style");
  style.textContent = STYLE;
  document.head.appendChild(style);
  const page = document.createElement("div");
  page.className = "gpu-page";
  const canvas = document.createElement("canvas");
  canvas.className = "gpu-canvas";
  canvas.tabIndex = 0;
  page.appendChild(canvas);
  const panel = document.createElement("div");
  panel.className = "gpu-panel open";
  panel.innerHTML = '<h2><span>BIM Open Schema &mdash; WebGPU multiDrawIndexedIndirect</span><button class="gpu-rollup" id="gpu-rollup" title="Hide the panel">&#9650;</button></h2><div id="gpu-body">' + ROWS.map(([id, label]) => `<div class="gpu-row"><span>${label}</span><span id="gpu-${id}">-</span></div>`).join("") + '<div class="gpu-note" id="gpu-note">Starting up...</div><label class="gpu-toggle"><input type="checkbox" id="gpu-multi" checked disabled>Use multiDrawIndexedIndirect</label><label class="gpu-toggle"><input type="checkbox" id="gpu-cull" disabled>GPU frustum culling</label><label class="gpu-toggle"><input type="checkbox" id="gpu-contrib" disabled>GPU contribution culling</label><div class="gpu-slider"><input type="range" id="gpu-contrib-px" min="0" max="1000" step="1" disabled><span id="gpu-contrib-value">-</span></div></div>';
  page.appendChild(panel);
  document.body.appendChild(page);
  const cell = (id) => document.getElementById("gpu-" + id);
  const note = cell("note");
  const body = cell("body");
  const rollup = cell("rollup");
  rollup.addEventListener("click", () => {
    const open = body.style.display !== "none";
    body.style.display = open ? "none" : "";
    panel.classList.toggle("open", !open);
    rollup.innerHTML = open ? "&#9660;" : "&#9650;";
    rollup.title = open ? "Show the panel" : "Hide the panel";
  });
  const toggle = cell("multi");
  const cullToggle = cell("cull");
  const contribToggle = cell("contrib");
  const contribSlider = cell("contrib-px");
  const contribValue = cell("contrib-value");
  return {
    canvas,
    toggle,
    cullToggle,
    contribToggle,
    contribSlider,
    contributionPixels() {
      return sliderToPixels(Number(contribSlider.value));
    },
    setContributionPixels(px) {
      contribSlider.value = String(pixelsToSlider(px));
      this.showContributionPixels();
    },
    showContributionPixels() {
      contribValue.textContent = this.contributionPixels().toFixed(2) + " px";
    },
    set(id, value) {
      cell(id).textContent = value;
    },
    setNote(text, bad = false) {
      note.textContent = text;
      note.className = bad ? "gpu-note bad" : "gpu-note";
      note.style.display = text ? "" : "none";
    }
  };
}
const fmt = (n) => n.toLocaleString("en-US");
function showStats(panel, stats) {
  panel.set("fps", stats.fps.toFixed(1));
  panel.set("cpu", stats.cpuMs.toFixed(2));
  panel.set("draws", fmt(stats.drawCommands));
  panel.set("drawn", stats.drawnCommands < stats.drawCommands ? fmt(stats.drawnCommands) : "all");
  panel.set("meshtris", fmt(Math.round(stats.meshTriangles)));
  panel.set("tris", fmt(Math.round(stats.triangles)));
}
const DEFAULT_MODEL = "Snowdon Towers Sample Architectural.bos";
const requested = new URLSearchParams(location.search).get("model") ?? DEFAULT_MODEL;
const MODEL = /^https?:\/\//.test(requested) ? requested : "/ara3d-webgl/" + requested;
async function run() {
  const panel = createGpuPanel();
  if (!isWebGpuAvailable()) {
    panel.setNote("WebGPU is not available in this browser. Use Chrome or Edge 113+.", true);
    return;
  }
  let viewer;
  try {
    viewer = await GpuViewer.create(panel.canvas);
  } catch (e) {
    panel.setNote(String(e.message ?? e), true);
    return;
  }
  const multiDraw = viewer.context.multiDraw;
  panel.set("adapter", viewer.context.adapterInfo);
  panel.set("status", multiDraw ? "supported" : "not available");
  panel.setNote(
    multiDraw ? "" : "Falling back to one drawIndexedIndirect per instance. " + MULTI_DRAW_HELP,
    !multiDraw
  );
  panel.toggle.disabled = !multiDraw;
  panel.toggle.checked = multiDraw;
  panel.toggle.addEventListener("change", () => {
    viewer.renderer.useMultiDraw = panel.toggle.checked;
    panel.set("status", panel.toggle.checked ? "multiDrawIndexedIndirect" : "drawIndexedIndirect loop");
  });
  panel.cullToggle.disabled = !multiDraw;
  panel.cullToggle.addEventListener("change", () => {
    viewer.renderer.culling = panel.cullToggle.checked;
  });
  panel.contribToggle.disabled = !multiDraw;
  panel.contribSlider.disabled = !multiDraw;
  panel.setContributionPixels(viewer.renderer.contributionThreshold);
  panel.contribToggle.addEventListener("change", () => {
    viewer.renderer.contributionCulling = panel.contribToggle.checked;
  });
  panel.contribSlider.addEventListener("input", () => {
    panel.showContributionPixels();
    viewer.renderer.contributionThreshold = panel.contributionPixels();
  });
  viewer.onFrame = (stats) => showStats(panel, stats);
  viewer.onStopped = (reason) => panel.setNote(reason, true);
  viewer.onStalled = (reason) => panel.set("fps", reason ? "paused" : "-");
  viewer.start();
  panel.setNote("Loading model...");
  const loader = new GpuModelLoader({ device: viewer.context.device });
  console.time("Loading model file");
  const model = await loader.load(MODEL);
  console.timeEnd("Loading model file");
  viewer.setScene(model.scene);
  window.gpuDemo = { viewer, model, panel };
  panel.setNote(loadedNote(viewer, multiDraw), !multiDraw);
  enableFileDrop(panel, viewer, loader);
}
function loadedNote(viewer, multiDraw) {
  if (multiDraw)
    return "";
  const r = viewer.renderer;
  const limited = r.fallbackActive ? `Showing the ${fmt(r.drawnCount)} largest of ${fmt(r.drawCount)} instances. ` : "";
  return "Multi-draw unavailable. " + limited + MULTI_DRAW_HELP;
}
function enableFileDrop(panel, viewer, loader) {
  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("dragover", stop);
  window.addEventListener("drop", async (e) => {
    stop(e);
    const file = [...e.dataTransfer?.files ?? []].find((f) => isGpuModelFile(f.name));
    if (!file)
      return;
    panel.setNote("Loading " + file.name + "...");
    try {
      const model = await loader.loadFromFile(file);
      viewer.setScene(model.scene);
      panel.setNote("Loaded " + file.name + ". " + loadedNote(viewer, viewer.context.multiDraw));
    } catch (err) {
      panel.setNote("Failed to load " + file.name + ": " + err, true);
    }
  });
}
run();
//# sourceMappingURL=exampleWebGpuMultiDraw.9e17197a.js.map
