var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { t as three_module, D as DefaultInputScheme, K as KEYS, V as Viewer, g as getSettings } from "./compressors.ca4e4f79.js";
import { G as GltfLoader } from "./gltfLoader.25e01610.js";
import { B as BimOpenSchemaLoader, l as loadBimGeometryFromZip } from "./bimOpenSchemaLoader.180bc89b.js";
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
  GltfLoader,
  BimOpenSchemaLoader,
  loadBimGeometryFromZip
}, Symbol.toStringTag, { value: "Module" }));
console.log(ARA3D);
//# sourceMappingURL=input.d9d9049d.js.map
