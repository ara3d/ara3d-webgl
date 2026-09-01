import { p as instanceMatrix, n as instanceColor, h as instanceMeshIndex, M as MESH_SLICE_INTS, g as instanceCount$1, l as instanceHidden, o as instanceAlpha } from "./renderModel.76ea7852.js";
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
  const requiredLimits = {
    maxBufferSize: adapter.limits.maxBufferSize,
    maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
  };
  const device = await adapter.requestDevice({ requiredFeatures, requiredLimits });
  device.addEventListener("uncapturederror", (e) => console.error("WebGPU:", e.error?.message));
  const lost = device.lost.then((info) => {
    console.error("WebGPU device lost:", info.reason, info.message);
    return info;
  });
  return { adapter, device, multiDraw, adapterInfo: describeAdapter(adapter), lost };
}
function describeAdapter(adapter) {
  const info = adapter.info;
  if (!info)
    return "unknown adapter";
  return [info.vendor, info.architecture, info.device, info.description].filter((s) => !!s).join(" ");
}
const MULTI_DRAW_HELP = "Launch Chrome or Edge with --enable-dawn-features=multi_draw_indirect and --enable-unsafe-webgpu.";
const cpuBytes = (data) => ({ kind: "cpu", data });
const gpuBytes = (gpuBuffer, byteLength2) => ({ kind: "gpu", gpuBuffer, byteLength: byteLength2 });
const byteLength = (b) => b.kind === "gpu" ? b.byteLength : b.data.byteLength;
const DRAW_COMMAND_WORDS = 5;
const INSTANCE_FLOATS = 20;
const drawCount = (s) => s.drawCommands.length / DRAW_COMMAND_WORDS;
const instanceCount = (s) => s.instanceIds.length;
const instancedTriangleCount = (s) => {
  let indices = 0;
  for (let i = 0; i < s.drawCommands.length; i += DRAW_COMMAND_WORDS) {
    indices += s.drawCommands[i] * s.drawCommands[i + 1];
  }
  return indices / 3;
};
const meshTriangleCount = (s) => byteLength(s.indices) / 4 / 3;
const columnVertices = (x, y, z, scale) => ({
  buffers: [x, y, z].map((column, i) => ({
    bytes: cpuBytes(column),
    stride: 4,
    attributes: [{ shaderLocation: i, offset: 0 }]
  })),
  format: "sint32",
  scale,
  count: x.length
});
const interleavedVertices = (bytes, floatsPerVertex) => ({
  buffers: [{
    bytes,
    stride: floatsPerVertex * 4,
    attributes: [0, 1, 2].map((shaderLocation) => ({ shaderLocation, offset: shaderLocation * 4 }))
  }],
  format: "float32",
  scale: 1,
  count: byteLength(bytes) / (floatsPerVertex * 4)
});
const buildGpuSceneFromModel = (model) => buildGpuSceneFromTables(
  model,
  interleavedVertices(cpuBytes(model.vertices), model.floatsPerVertex),
  cpuBytes(model.indices)
);
function buildGpuSceneFromTables(model, vertices, indices) {
  console.time("Building GPU scene");
  if (model.meta.primitiveSize !== 3) {
    throw new Error(
      `Only triangle models can be rendered; this one has ${model.meta.primitiveSize} vertices per primitive.`
    );
  }
  const visible = collectVisibleInstances(model);
  const n = visible.length;
  const instanceData = new Float32Array(n * INSTANCE_FLOATS);
  const instanceSpheres = new Float32Array(n * 4);
  const instanceIds = new Uint32Array(n);
  const drawCommands = new Uint32Array(n * DRAW_COMMAND_WORDS);
  let triangleCount = 0;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let slot = 0; slot < n; slot++) {
    const i = visible[slot];
    const base = slot * INSTANCE_FLOATS;
    instanceMatrix(model, i, instanceData, base);
    const color = instanceColor(model, i);
    instanceData[base + 16] = (color & 255) / 255;
    instanceData[base + 17] = (color >>> 8 & 255) / 255;
    instanceData[base + 18] = (color >>> 16 & 255) / 255;
    instanceData[base + 19] = (color >>> 24 & 255) / 255;
    const b = i * 6;
    const cx = (model.instanceBounds[b] + model.instanceBounds[b + 3]) * 0.5;
    const cy = (model.instanceBounds[b + 1] + model.instanceBounds[b + 4]) * 0.5;
    const cz = (model.instanceBounds[b + 2] + model.instanceBounds[b + 5]) * 0.5;
    const hx = (model.instanceBounds[b + 3] - model.instanceBounds[b]) * 0.5;
    const hy = (model.instanceBounds[b + 4] - model.instanceBounds[b + 1]) * 0.5;
    const hz = (model.instanceBounds[b + 5] - model.instanceBounds[b + 2]) * 0.5;
    const radius = Math.sqrt(hx * hx + hy * hy + hz * hz);
    instanceSpheres[slot * 4 + 0] = cx;
    instanceSpheres[slot * 4 + 1] = cy;
    instanceSpheres[slot * 4 + 2] = cz;
    instanceSpheres[slot * 4 + 3] = radius;
    minX = Math.min(minX, cx - radius);
    maxX = Math.max(maxX, cx + radius);
    minY = Math.min(minY, cy - radius);
    maxY = Math.max(maxY, cy + radius);
    minZ = Math.min(minZ, cz - radius);
    maxZ = Math.max(maxZ, cz + radius);
    const slice = instanceMeshIndex(model, i) * MESH_SLICE_INTS;
    const indexCount = model.meshSlices[slice + 3];
    const cmd = slot * DRAW_COMMAND_WORDS;
    drawCommands[cmd + 0] = indexCount;
    drawCommands[cmd + 1] = 1;
    drawCommands[cmd + 2] = model.meshSlices[slice + 2];
    drawCommands[cmd + 3] = model.meshSlices[slice + 0];
    drawCommands[cmd + 4] = slot;
    instanceIds[slot] = i;
    triangleCount += indexCount / 3;
  }
  const opaqueCount = countOpaque(instanceData, n);
  const scene = {
    vertices,
    indices,
    instanceData,
    instanceSpheres,
    instanceIds,
    drawCommands,
    opaque: { first: 0, count: opaqueCount },
    transparent: { first: opaqueCount, count: n - opaqueCount },
    triangleCount,
    ...sceneBounds(model, [minX, minY, minZ], [maxX, maxY, maxZ])
  };
  console.timeEnd("Building GPU scene");
  console.log(
    `GPU scene: ${n} draws, ${triangleCount} triangles, ${vertices.count} vertices`
  );
  return scene;
}
function sceneBounds(model, min, max) {
  const { boundsMin, boundsMax } = model.meta;
  const usable = boundsMin.every(isFinite) && boundsMax.every(isFinite) && boundsMin.every((v, i) => v <= boundsMax[i]);
  return usable ? { boundsMin, boundsMax } : { boundsMin: min, boundsMax: max };
}
function collectVisibleInstances(model) {
  const count = instanceCount$1(model);
  const opaque = [];
  const transparent = [];
  for (let i = 0; i < count; i++) {
    const mesh = instanceMeshIndex(model, i);
    if (mesh < 0)
      continue;
    if (instanceHidden(model, i))
      continue;
    if (model.meshSlices[mesh * MESH_SLICE_INTS + 3] === 0)
      continue;
    (instanceAlpha(model, i) < 255 ? transparent : opaque).push(i);
  }
  return Int32Array.from(opaque.concat(transparent));
}
const countOpaque = (instanceData, n) => {
  let count = 0;
  while (count < n && instanceData[count * INSTANCE_FLOATS + 19] >= 1)
    count++;
  return count;
};
export {
  DRAW_COMMAND_WORDS as D,
  INSTANCE_FLOATS as I,
  MULTI_DRAW_HELP as M,
  cpuBytes as a,
  buildGpuSceneFromTables as b,
  columnVertices as c,
  buildGpuSceneFromModel as d,
  instanceCount as e,
  drawCount as f,
  gpuBytes as g,
  instancedTriangleCount as h,
  interleavedVertices as i,
  isWebGpuAvailable as j,
  meshTriangleCount as m,
  requestGpuContext as r
};
//# sourceMappingURL=buildGpuSceneFromModel.e01cea5b.js.map
