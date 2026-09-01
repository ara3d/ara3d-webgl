var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import "./modulepreload-polyfill.c7c6310f.js";
import { t as three_module, V as Viewer } from "./viewer.b9ba82bf.js";
import { D as DefaultInputScheme, K as KEYS, g as getSettings, B as BimOpenSchemaLoader, l as loadBimGeometryFromZip } from "./bimOpenSchemaLoader.bafda526.js";
import { C as CameraControls, a as CanvasViewport, m as memorySink, B as BFastStreamReader, r as readBFastStream } from "./bfastStream.3dc97dce.js";
import { G as GltfLoader } from "./gltfLoader.e48e4a6a.js";
import { D as DataTable } from "./DataTable.e67c04b5.js";
import { B as BFAST_MAGIC, a as BFast, i as isBFast, r as readBFastHeader, b as BFAST_HEADER_PROBE, c as bfastHeaderSize, d as readBFast, M as MESH_SLICE_INTS, I as INSTANCE_BYTES, e as INSTANCE_FLOAT_STRIDE, f as INSTANCE_HIDDEN_FLAG, N as NO_MESH_INDEX, V as VERTEX_COLORS_FLAG, m as meshCount, g as instanceCount, v as vertexCount, h as instanceMeshIndex, j as instanceEntityIndex, k as instanceFlags, l as instanceHidden, n as instanceColor, o as instanceAlpha, p as instanceMatrix, R as RENDER_MODEL_BUFFERS, q as isRenderModel, s as readRenderModelTables, t as readRenderModel } from "./renderModel.76ea7852.js";
class GizmoOptions {
  constructor(init) {
    __publicField(this, "size", 84);
    __publicField(this, "padding", 4);
    __publicField(this, "bubbleSizePrimary", 8);
    __publicField(this, "bubbleSizeSecondary", 6);
    __publicField(this, "lineWidth", 2);
    __publicField(this, "fontSize", "12px");
    __publicField(this, "fontFamily", "arial");
    __publicField(this, "fontWeight", "bold");
    __publicField(this, "fontColor", "#222222");
    __publicField(this, "className", "gizmo-axis-canvas");
    __publicField(this, "colorX", "#f73c3c");
    __publicField(this, "colorY", "#6ccb26");
    __publicField(this, "colorZ", "#178cf0");
    __publicField(this, "colorXSub", "#942424");
    __publicField(this, "colorYSub", "#417a17");
    __publicField(this, "colorZSub", "#0e5490");
    this.size = init?.size ?? this.size;
    this.padding = init?.padding ?? this.padding;
    this.bubbleSizePrimary = init?.bubbleSizePrimary ?? this.bubbleSizePrimary;
    this.bubbleSizeSecondary = init?.bubbleSizeSecondary ?? this.bubbleSizeSecondary;
    this.lineWidth = init?.lineWidth ?? this.lineWidth;
    this.fontSize = init?.fontSize ?? this.fontSize;
    this.fontFamily = init?.fontFamily ?? this.fontFamily;
    this.fontWeight = init?.fontWeight ?? this.fontWeight;
    this.fontColor = init?.fontColor ?? this.fontColor;
    this.className = init?.className ?? this.className;
    this.colorX = init?.colorX ?? this.colorX;
    this.colorY = init?.colorY ?? this.colorY;
    this.colorZ = init?.colorZ ?? this.colorZ;
    this.colorXSub = init?.colorXSub ?? this.colorXSub;
    this.colorYSub = init?.colorYSub ?? this.colorYSub;
    this.colorZSub = init?.colorZSub ?? this.colorZSub;
  }
}
const ARA3D = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  THREE: three_module,
  DefaultInputScheme,
  KEYS,
  Viewer,
  GizmoOptions,
  getSettings,
  CameraControls,
  CanvasViewport,
  GltfLoader,
  BimOpenSchemaLoader,
  loadBimGeometryFromZip,
  DataTable,
  BFAST_MAGIC,
  BFast,
  isBFast,
  readBFastHeader,
  BFAST_HEADER_PROBE,
  bfastHeaderSize,
  readBFast,
  MESH_SLICE_INTS,
  INSTANCE_BYTES,
  INSTANCE_FLOAT_STRIDE,
  INSTANCE_HIDDEN_FLAG,
  NO_MESH_INDEX,
  VERTEX_COLORS_FLAG,
  meshCount,
  instanceCount,
  vertexCount,
  instanceMeshIndex,
  instanceEntityIndex,
  instanceFlags,
  instanceHidden,
  instanceColor,
  instanceAlpha,
  instanceMatrix,
  RENDER_MODEL_BUFFERS,
  isRenderModel,
  readRenderModelTables,
  readRenderModel,
  memorySink,
  BFastStreamReader,
  readBFastStream
}, Symbol.toStringTag, { value: "Module" }));
console.log(ARA3D);
//# sourceMappingURL=input.ef63f9eb.js.map
