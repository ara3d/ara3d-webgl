var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { r as Matrix4, a as Vector3, eX as Quaternion, g3 as JSZip, l as loadBimGeometryFromZip, P as PerspectiveCamera, fX as WebGPUCoordinateSystem } from "./bimOpenSchemaLoader.1c0420b7.js";
const MULTI_DRAW_FEATURE = "chromium-experimental-multi-draw-indirect";
const FIRST_INSTANCE_FEATURE = "indirect-first-instance";
function isWebGpuAvailable() {
  return typeof navigator !== "undefined" && !!navigator.gpu;
}
async function requestGpuContext() {
  if (!isWebGpuAvailable()) {
    throw new Error("WebGPU is not available in this browser.");
  }
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
  if (!adapter) {
    throw new Error("No WebGPU adapter found.");
  }
  if (!adapter.features.has(FIRST_INSTANCE_FEATURE)) {
    throw new Error(
      'This adapter does not support "indirect-first-instance", which indirect drawing needs here.'
    );
  }
  const multiDraw = adapter.features.has(MULTI_DRAW_FEATURE);
  const requiredFeatures = [FIRST_INSTANCE_FEATURE];
  if (multiDraw)
    requiredFeatures.push(MULTI_DRAW_FEATURE);
  const device = await adapter.requestDevice({ requiredFeatures });
  device.addEventListener("uncapturederror", (e) => console.error("WebGPU:", e.error?.message));
  return { adapter, device, multiDraw, adapterInfo: describeAdapter(adapter) };
}
function describeAdapter(adapter) {
  const info = adapter.info;
  if (!info)
    return "unknown adapter";
  return [info.vendor, info.architecture, info.device, info.description].filter((s) => !!s).join(" ");
}
const MULTI_DRAW_HELP = "Launch Chrome or Edge with --enable-dawn-features=multi_draw_indirect and --enable-unsafe-webgpu.";
const DRAW_COMMAND_WORDS = 5;
const INSTANCE_FLOATS = 20;
const drawCount = (s) => s.drawCommands.length / DRAW_COMMAND_WORDS;
const instanceCount = (s) => s.instanceIds.length;
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
  const matrix = new Matrix4();
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
    matrix.compose(position, quaternion, scale);
    const base = slot * INSTANCE_FLOATS;
    instanceData.set(matrix.elements, base);
    instanceData[base + 16] = bg.MaterialRed[mat] / 255;
    instanceData[base + 17] = bg.MaterialGreen[mat] / 255;
    instanceData[base + 18] = bg.MaterialBlue[mat] / 255;
    instanceData[base + 19] = bg.MaterialAlpha[mat] / 255;
    center.set(meshSpheres[mesh * 4], meshSpheres[mesh * 4 + 1], meshSpheres[mesh * 4 + 2]).applyMatrix4(matrix);
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
    vertexX: bg.VertexX,
    vertexY: bg.VertexY,
    vertexZ: bg.VertexZ,
    vertexScale,
    indices: new Uint32Array(bg.IndexBuffer.buffer, bg.IndexBuffer.byteOffset, totalIndices),
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
class BosGpuLoader {
  async load(source) {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`);
    }
    return this.loadFromArrayBuffer(await response.arrayBuffer());
  }
  async loadFromFile(file) {
    return this.loadFromArrayBuffer(await file.arrayBuffer());
  }
  async loadFromArrayBuffer(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const bim = await loadBimGeometryFromZip(zip);
    return { bim, scene: buildGpuScene(bim.BimGeometry) };
  }
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
const align4 = (n) => n + 3 & ~3;
const sceneShader = `
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
`;
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
    __publicField(this, "opaquePipeline");
    __publicField(this, "transparentPipeline");
    __publicField(this, "resources");
    __publicField(this, "depth");
    __publicField(this, "color");
    __publicField(this, "width", 0);
    __publicField(this, "height", 0);
    __publicField(this, "useMultiDraw");
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
    const module = ctx.device.createShaderModule({ label: "scene", code: sceneShader });
    this.opaquePipeline = this.createPipeline(module, false);
    this.transparentPipeline = this.createPipeline(module, true);
  }
  createPipeline(module, transparent) {
    const column = (shaderLocation) => ({
      arrayStride: 4,
      attributes: [{ shaderLocation, offset: 0, format: "sint32" }]
    });
    return this.ctx.device.createRenderPipeline({
      label: transparent ? "transparent" : "opaque",
      layout: this.ctx.device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
      vertex: {
        module,
        entryPoint: "vs",
        buffers: [column(0), column(1), column(2)]
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
    const vertexX = createBuffer(device, scene.vertexX, GPUBufferUsage.VERTEX, "vertexX");
    const vertexY = createBuffer(device, scene.vertexY, GPUBufferUsage.VERTEX, "vertexY");
    const vertexZ = createBuffer(device, scene.vertexZ, GPUBufferUsage.VERTEX, "vertexZ");
    const indices = createBuffer(device, scene.indices, GPUBufferUsage.INDEX, "indices");
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
    this.resources = { scene, vertexX, vertexY, vertexZ, indices, instances, indirect, bindGroup };
    console.timeEnd("Uploading GPU buffers");
  }
  get drawCount() {
    return this.resources ? drawCount(this.resources.scene) : 0;
  }
  render(viewProj, eye) {
    const r = this.resources;
    if (!r)
      return;
    this.resize();
    this.updateCamera(viewProj, eye, r.scene.vertexScale);
    const encoder = this.ctx.device.createCommandEncoder();
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
    pass.setVertexBuffer(0, r.vertexX);
    pass.setVertexBuffer(1, r.vertexY);
    pass.setVertexBuffer(2, r.vertexZ);
    pass.setIndexBuffer(r.indices, "uint32");
    pass.setPipeline(this.opaquePipeline);
    this.drawRange(pass, r.indirect, r.scene.opaque);
    pass.setPipeline(this.transparentPipeline);
    this.drawRange(pass, r.indirect, r.scene.transparent);
    pass.end();
    this.ctx.device.queue.submit([encoder.finish()]);
  }
  drawRange(pass, indirect, range) {
    if (range.count === 0)
      return;
    const stride = DRAW_COMMAND_WORDS * 4;
    const offset = range.first * stride;
    if (this.useMultiDraw && this.ctx.multiDraw) {
      pass.multiDrawIndexedIndirect(indirect, offset, range.count);
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
    for (const b of [r.vertexX, r.vertexY, r.vertexZ, r.indices, r.instances, r.indirect]) {
      b.destroy();
    }
    this.resources = void 0;
  }
  dispose() {
    this.releaseScene();
    this.depth?.destroy();
    this.color?.destroy();
    this.cameraBuffer.destroy();
  }
}
const BLEND_OVER = {
  color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
  alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
};
class OrbitCamera {
  constructor() {
    __publicField(this, "camera", new PerspectiveCamera(50, 1, 0.05, 1e4));
    __publicField(this, "target", new Vector3());
    __publicField(this, "distance", 10);
    __publicField(this, "azimuth", Math.PI * 0.25);
    __publicField(this, "elevation", Math.PI * 0.2);
    __publicField(this, "viewProj", new Matrix4());
    this.camera.up.set(0, 0, 1);
    this.camera.coordinateSystem = WebGPUCoordinateSystem;
  }
  frame(min, max) {
    this.target.addVectors(min, max).multiplyScalar(0.5);
    const radius = Math.max(min.distanceTo(max) * 0.5, 1e-3);
    this.distance = radius / Math.tan(this.camera.fov * Math.PI / 360);
    this.camera.near = Math.max(this.distance / 5e3, 0.01);
    this.camera.far = this.distance * 20;
    this.update();
  }
  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.update();
  }
  orbit(dx, dy) {
    const limit = Math.PI / 2 - 0.01;
    this.azimuth -= dx;
    this.elevation = clamp(this.elevation + dy, -limit, limit);
    this.update();
  }
  pan(dx, dy) {
    const scale = this.distance * 1e-3;
    const right = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
    this.target.addScaledVector(right, -dx * scale).addScaledVector(up, dy * scale);
    this.update();
  }
  zoom(delta) {
    this.distance = clamp(this.distance * Math.exp(delta * 1e-3), 0.01, 1e6);
    this.update();
  }
  update() {
    const cosE = Math.cos(this.elevation);
    this.camera.position.set(
      this.target.x + this.distance * cosE * Math.cos(this.azimuth),
      this.target.y + this.distance * cosE * Math.sin(this.azimuth),
      this.target.z + this.distance * Math.sin(this.elevation)
    );
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld(true);
    this.camera.updateProjectionMatrix();
    this.viewProj.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
  }
  get viewProjection() {
    return this.viewProj;
  }
  get eye() {
    return this.camera.position;
  }
}
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
function attachOrbitInput(canvas, camera) {
  let button = -1;
  let lastX = 0;
  let lastY = 0;
  const down = (e) => {
    button = e.button;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (button < 0)
      return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (button === 0)
      camera.orbit(dx * 5e-3, dy * 5e-3);
    else
      camera.pan(dx, dy);
  };
  const up = (e) => {
    button = -1;
    canvas.releasePointerCapture(e.pointerId);
  };
  const wheel = (e) => {
    e.preventDefault();
    camera.zoom(e.deltaY);
  };
  const menu = (e) => e.preventDefault();
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  canvas.addEventListener("contextmenu", menu);
  return () => {
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
    canvas.removeEventListener("wheel", wheel);
    canvas.removeEventListener("contextmenu", menu);
  };
}
class GpuViewer {
  constructor(canvas, ctx) {
    __publicField(this, "renderer");
    __publicField(this, "camera", new OrbitCamera());
    __publicField(this, "onFrame");
    __publicField(this, "detachInput");
    __publicField(this, "running", false);
    __publicField(this, "frames", 0);
    __publicField(this, "frameStart", 0);
    __publicField(this, "cpuMs", 0);
    __publicField(this, "triangles", 0);
    __publicField(this, "loop", () => {
      if (!this.running)
        return;
      this.camera.setAspect(this.renderer.aspect || 1);
      const t0 = performance.now();
      this.renderer.render(this.camera.viewProjection, this.camera.eye);
      this.cpuMs += performance.now() - t0;
      this.frames++;
      const elapsed = performance.now() - this.frameStart;
      if (elapsed > 500 && this.onFrame) {
        this.onFrame({
          fps: this.frames * 1e3 / elapsed,
          cpuMs: this.cpuMs / this.frames,
          drawCommands: this.renderer.drawCount,
          triangles: this.triangles,
          multiDraw: this.renderer.useMultiDraw && this.context.multiDraw
        });
        this.frames = 0;
        this.cpuMs = 0;
        this.frameStart = performance.now();
      }
      requestAnimationFrame(this.loop);
    });
    this.renderer = new GpuRenderer(canvas, ctx);
    this.detachInput = attachOrbitInput(canvas, this.camera);
  }
  static async create(canvas) {
    return new GpuViewer(canvas, await requestGpuContext());
  }
  get context() {
    return this.renderer.ctx;
  }
  setScene(scene) {
    this.renderer.setScene(scene);
    this.triangles = scene.triangleCount;
    this.camera.frame(
      new Vector3().fromArray(scene.boundsMin),
      new Vector3().fromArray(scene.boundsMax)
    );
    console.log(`Scene has ${instanceCount(scene)} instances`);
  }
  start() {
    if (this.running)
      return;
    this.running = true;
    this.frameStart = performance.now();
    requestAnimationFrame(this.loop);
  }
  stop() {
    this.running = false;
  }
  dispose() {
    this.stop();
    this.detachInput();
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
.gpu-panel h2 { font-size: 13px; margin: 0 0 8px; color: #9fd0ff; font-weight: 600; }
.gpu-row { display: flex; justify-content: space-between; gap: 16px; }
.gpu-row span:last-child { color: #ffd479; }
.gpu-note { margin-top: 8px; color: #9aa4b2; }
.gpu-note.bad { color: #ff8f8f; }
.gpu-toggle { margin-top: 10px; display: flex; align-items: center; gap: 6px; color: #cbd4e1; }
`;
const ROWS = [
  ["adapter", "Adapter"],
  ["status", "Multi-draw"],
  ["draws", "Draw commands"],
  ["tris", "Triangles"],
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
  panel.className = "gpu-panel";
  panel.innerHTML = "<h2>BIM Open Schema &mdash; WebGPU multiDrawIndexedIndirect</h2>" + ROWS.map(([id, label]) => `<div class="gpu-row"><span>${label}</span><span id="gpu-${id}">-</span></div>`).join("") + '<div class="gpu-note" id="gpu-note">Starting up...</div><label class="gpu-toggle"><input type="checkbox" id="gpu-multi" checked disabled>Use multiDrawIndexedIndirect</label>';
  page.appendChild(panel);
  document.body.appendChild(page);
  const cell = (id) => document.getElementById("gpu-" + id);
  const note = cell("note");
  const toggle = cell("multi");
  return {
    canvas,
    toggle,
    set(id, value) {
      cell(id).textContent = value;
    },
    setNote(text, bad = false) {
      note.textContent = text;
      note.className = bad ? "gpu-note bad" : "gpu-note";
    }
  };
}
const fmt = (n) => n.toLocaleString("en-US");
function showStats(panel, stats) {
  panel.set("fps", stats.fps.toFixed(1));
  panel.set("cpu", stats.cpuMs.toFixed(2));
  panel.set("draws", fmt(stats.drawCommands));
  panel.set("tris", fmt(Math.round(stats.triangles)));
}
const MODEL = "/ara3d-webgl/Snowdon Towers Sample Architectural.bos";
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
    multiDraw ? "One call per pass draws the whole model. Untick to compare against one drawIndexedIndirect per instance." : "Falling back to one drawIndexedIndirect per instance. " + MULTI_DRAW_HELP,
    !multiDraw
  );
  panel.toggle.disabled = !multiDraw;
  panel.toggle.checked = multiDraw;
  panel.toggle.addEventListener("change", () => {
    viewer.renderer.useMultiDraw = panel.toggle.checked;
    panel.set("status", panel.toggle.checked ? "multiDrawIndexedIndirect" : "drawIndexedIndirect loop");
  });
  viewer.onFrame = (stats) => showStats(panel, stats);
  viewer.start();
  panel.setNote("Loading model...");
  const loader = new BosGpuLoader();
  console.time("Loading .bos file");
  const model = await loader.load(MODEL);
  console.timeEnd("Loading .bos file");
  viewer.setScene(model.scene);
  window.gpuDemo = { viewer, model, panel };
  panel.setNote(
    multiDraw ? "Drag to orbit, right drag to pan, wheel to zoom. Drop a .bos file to load your own." : "Multi-draw unavailable. " + MULTI_DRAW_HELP
  );
  enableFileDrop(panel, viewer, loader);
}
function enableFileDrop(panel, viewer, loader) {
  const stop = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  window.addEventListener("dragover", stop);
  window.addEventListener("drop", async (e) => {
    stop(e);
    const file = [...e.dataTransfer?.files ?? []].find((f) => f.name.toLowerCase().endsWith(".bos"));
    if (!file)
      return;
    panel.setNote("Loading " + file.name + "...");
    try {
      const model = await loader.loadFromFile(file);
      viewer.setScene(model.scene);
      panel.setNote("Loaded " + file.name);
    } catch (err) {
      panel.setNote("Failed to load " + file.name + ": " + err, true);
    }
  });
}
run();
//# sourceMappingURL=exampleWebGpuMultiDraw.1c9ad80e.js.map
