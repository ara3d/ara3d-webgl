var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
const BFAST_MAGIC = 49061;
const PREAMBLE_BYTES = 32;
const RANGE_BYTES = 16;
class BFast {
  constructor(buffers) {
    __publicField(this, "buffers");
    __publicField(this, "byName");
    this.buffers = buffers;
    this.byName = new Map(buffers.map((b) => [b.name, b.bytes]));
  }
  get names() {
    return this.buffers.map((b) => b.name);
  }
  find(name) {
    return this.byName.get(name);
  }
  get(name) {
    const bytes = this.byName.get(name);
    if (!bytes) {
      throw new Error(`BFAST has no buffer named "${name}". Found: ${this.names.join(", ")}`);
    }
    return bytes;
  }
}
function isBFast(buffer, byteOffset = 0) {
  if (buffer.byteLength - byteOffset < PREAMBLE_BYTES)
    return false;
  const view2 = new DataView(buffer, byteOffset, 8);
  return view2.getUint32(0, true) === BFAST_MAGIC && view2.getUint32(4, true) === 0;
}
function readBFastHeader(buffer, byteOffset = 0) {
  if (!isBFast(buffer, byteOffset)) {
    const magic = buffer.byteLength >= byteOffset + 8 ? new DataView(buffer, byteOffset, 8).getUint32(0, true).toString(16) : "too short";
    throw new Error(`Not a little endian BFAST file (magic 0x${magic}).`);
  }
  const available = buffer.byteLength - byteOffset;
  const header = new DataView(buffer, byteOffset, PREAMBLE_BYTES);
  const count = readInt64(header, 24);
  if (count < 1)
    throw new Error(`BFAST has ${count} buffers; there must be at least one.`);
  const rangesEnd = PREAMBLE_BYTES + count * RANGE_BYTES;
  requireBytes(available, rangesEnd, "range table");
  const ranges = new DataView(buffer, byteOffset + PREAMBLE_BYTES, count * RANGE_BYTES);
  const at = (i) => [readInt64(ranges, i * RANGE_BYTES), readInt64(ranges, i * RANGE_BYTES + 8)];
  const [nameBegin, nameEnd] = at(0);
  requireBytes(available, nameEnd, "name buffer");
  const names = splitNames(new Uint8Array(buffer, byteOffset + nameBegin, nameEnd - nameBegin));
  if (names.length < count - 1) {
    throw new Error(`BFAST has ${count - 1} buffers but only ${names.length} names.`);
  }
  const out = [];
  for (let i = 1; i < count; i++) {
    const [begin, end] = at(i);
    out.push({ name: names[i - 1], begin, end });
  }
  return out;
}
const BFAST_HEADER_PROBE = 64 * 1024;
function bfastHeaderSize(buffer, byteOffset = 0) {
  const available = buffer.byteLength - byteOffset;
  if (available < PREAMBLE_BYTES)
    return void 0;
  const count = readInt64(new DataView(buffer, byteOffset, PREAMBLE_BYTES), 24);
  if (count < 1)
    throw new Error(`BFAST has ${count} buffers; there must be at least one.`);
  const rangesEnd = PREAMBLE_BYTES + count * RANGE_BYTES;
  if (available < rangesEnd)
    return rangesEnd;
  return readInt64(new DataView(buffer, byteOffset + PREAMBLE_BYTES, RANGE_BYTES), 8);
}
function readBFast(buffer, byteOffset = 0) {
  const ranges = readBFastHeader(buffer, byteOffset);
  const available = buffer.byteLength - byteOffset;
  return new BFast(ranges.map(({ name, begin, end }) => {
    requireBytes(available, end, `buffer "${name}"`);
    return { name, bytes: new Uint8Array(buffer, byteOffset + begin, end - begin) };
  }));
}
const requireBytes = (available, needed, what) => {
  if (available < needed) {
    throw new Error(`BFAST ${what} needs ${needed} bytes but only ${available} are present.`);
  }
};
function readInt64(view2, offset) {
  const value = view2.getBigInt64(offset, true);
  if (value > Number.MAX_SAFE_INTEGER || value < 0) {
    throw new Error(`BFAST offset ${value} is out of range.`);
  }
  return Number(value);
}
const splitNames = (bytes) => {
  const text = new TextDecoder().decode(bytes).replace(/\0+$/, "");
  return text.length === 0 ? [] : text.split("\0");
};
const MESH_SLICE_INTS = 4;
const INSTANCE_BYTES = 64;
const INSTANCE_FLOAT_STRIDE = INSTANCE_BYTES / 4;
const INSTANCE_HIDDEN_FLAG = 1;
const NO_MESH_INDEX = -1;
const VERTEX_COLORS_FLAG = 1;
const meshCount = (m) => m.meshSlices.length / MESH_SLICE_INTS;
const instanceCount = (m) => m.instanceInts.length / INSTANCE_FLOAT_STRIDE;
const vertexCount = (m) => m.vertices.length / m.floatsPerVertex;
const MESH_INDEX_WORD = 12;
const ENTITY_INDEX_WORD = 13;
const PACKED_COLOR_WORD = 14;
const FLAGS_WORD = 15;
const instanceMeshIndex = (m, i) => m.instanceInts[i * INSTANCE_FLOAT_STRIDE + MESH_INDEX_WORD];
const instanceEntityIndex = (m, i) => m.instanceInts[i * INSTANCE_FLOAT_STRIDE + ENTITY_INDEX_WORD];
const instanceFlags = (m, i) => m.instanceInts[i * INSTANCE_FLOAT_STRIDE + FLAGS_WORD] >>> 8 & 255;
const instanceHidden = (m, i) => (instanceFlags(m, i) & INSTANCE_HIDDEN_FLAG) !== 0;
const instanceColor = (m, i) => m.instanceInts[i * INSTANCE_FLOAT_STRIDE + PACKED_COLOR_WORD] >>> 0;
const instanceAlpha = (m, i) => instanceColor(m, i) >>> 24 & 255;
function instanceMatrix(m, i, out, at = 0) {
  const f = m.instanceFloats;
  const r = i * INSTANCE_FLOAT_STRIDE;
  out[at + 0] = f[r + 0];
  out[at + 1] = f[r + 4];
  out[at + 2] = f[r + 8];
  out[at + 3] = 0;
  out[at + 4] = f[r + 1];
  out[at + 5] = f[r + 5];
  out[at + 6] = f[r + 9];
  out[at + 7] = 0;
  out[at + 8] = f[r + 2];
  out[at + 9] = f[r + 6];
  out[at + 10] = f[r + 10];
  out[at + 11] = 0;
  out[at + 12] = f[r + 3];
  out[at + 13] = f[r + 7];
  out[at + 14] = f[r + 11];
  out[at + 15] = 1;
  return out;
}
const RENDER_MODEL_BUFFERS = {
  vertices: "VertexData",
  indices: "IndexData",
  meshSlices: "MeshSliceData",
  instances: "InstanceData",
  meshBounds: "MeshBoundsData",
  instanceBounds: "InstanceBoundsData",
  meta: "Meta"
};
const isRenderModel = (bfast) => Object.values(RENDER_MODEL_BUFFERS).every((n) => bfast.find(n) !== void 0);
function readRenderModelTables(source) {
  const B = RENDER_MODEL_BUFFERS;
  const meta = readMeta(source(B.meta));
  const instanceBytes = source(B.instances);
  return {
    floatsPerVertex: (meta.flags & VERTEX_COLORS_FLAG) !== 0 ? 6 : 3,
    meshSlices: asInts(source(B.meshSlices), B.meshSlices),
    instanceFloats: asFloats(instanceBytes, B.instances),
    instanceInts: asInts(instanceBytes, B.instances),
    meshBounds: asFloats(source(B.meshBounds), B.meshBounds),
    instanceBounds: asFloats(source(B.instanceBounds), B.instanceBounds),
    meta
  };
}
function readRenderModel(bfast) {
  const B = RENDER_MODEL_BUFFERS;
  return {
    ...readRenderModelTables((name) => bfast.get(name)),
    vertices: asFloats(bfast.get(B.vertices), B.vertices),
    indices: asUints(bfast.get(B.indices), B.indices)
  };
}
function readMeta(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    boundsMin: [v.getFloat32(0, true), v.getFloat32(4, true), v.getFloat32(8, true)],
    boundsMax: [v.getFloat32(12, true), v.getFloat32(16, true), v.getFloat32(20, true)],
    totalVertexCount: Number(v.getBigInt64(24, true)),
    totalFaceCount: Number(v.getBigInt64(32, true)),
    primitiveSize: v.getInt32(40, true),
    flags: v.getInt32(44, true)
  };
}
function view(bytes, name, Ctor) {
  const size = Ctor.BYTES_PER_ELEMENT;
  if (bytes.byteLength % size !== 0) {
    throw new Error(`BFAST buffer "${name}" is ${bytes.byteLength} bytes, not a multiple of ${size}.`);
  }
  const aligned = bytes.byteOffset % size === 0 ? bytes : new Uint8Array(bytes);
  return new Ctor(aligned.buffer, aligned.byteOffset, aligned.byteLength / size);
}
const asFloats = (b, name) => view(b, name, Float32Array);
const asInts = (b, name) => view(b, name, Int32Array);
const asUints = (b, name) => view(b, name, Uint32Array);
export {
  BFAST_MAGIC as B,
  INSTANCE_BYTES as I,
  MESH_SLICE_INTS as M,
  NO_MESH_INDEX as N,
  RENDER_MODEL_BUFFERS as R,
  VERTEX_COLORS_FLAG as V,
  BFast as a,
  BFAST_HEADER_PROBE as b,
  bfastHeaderSize as c,
  readBFast as d,
  INSTANCE_FLOAT_STRIDE as e,
  INSTANCE_HIDDEN_FLAG as f,
  instanceCount as g,
  instanceMeshIndex as h,
  isBFast as i,
  instanceEntityIndex as j,
  instanceFlags as k,
  instanceHidden as l,
  meshCount as m,
  instanceColor as n,
  instanceAlpha as o,
  instanceMatrix as p,
  isRenderModel as q,
  readBFastHeader as r,
  readRenderModelTables as s,
  readRenderModel as t,
  vertexCount as v
};
//# sourceMappingURL=renderModel.76ea7852.js.map
