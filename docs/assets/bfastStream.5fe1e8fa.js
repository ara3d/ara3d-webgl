var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { V as Vector2, g as getSettings, g9 as Camera, ga as Input } from "./bimOpenSchemaLoader.69b9fd7e.js";
import { c as bfastHeaderSize, r as readBFastHeader } from "./renderModel.76ea7852.js";
class CanvasViewport {
  constructor(canvas) {
    __publicField(this, "canvas");
    this.canvas = canvas;
  }
  getSize() {
    return new Vector2(this.canvas.clientWidth, this.canvas.clientHeight);
  }
  getAspectRatio() {
    const size = this.getSize();
    return size.y === 0 ? 1 : size.x / size.y;
  }
}
class CameraControls {
  constructor(canvas, options) {
    __publicField(this, "camera");
    __publicField(this, "viewport");
    __publicField(this, "settings");
    __publicField(this, "inputs");
    __publicField(this, "onRequestRender");
    this.settings = getSettings(options);
    this.viewport = new CanvasViewport(canvas);
    this.camera = new Camera(this.viewport, this.settings);
    this.inputs = new Input(this);
    this.inputs.registerAll();
  }
  requestRender() {
    this.onRequestRender?.();
  }
  update(deltaTime) {
    return this.camera.update(deltaTime);
  }
  frame(bounds, forward = this.camera.defaultForward) {
    this.camera.sceneBounds = bounds.clone();
    this.camera.do().frame(bounds, forward);
    this.camera.save();
  }
  setClipPlanes(near, far) {
    const perspective = this.camera.camPerspective.camera;
    perspective.near = near;
    perspective.far = far;
    perspective.updateProjectionMatrix();
    const orthographic = this.camera.camOrthographic.camera;
    orthographic.near = -far;
    orthographic.far = far;
    orthographic.updateProjectionMatrix();
  }
  dispose() {
    this.inputs.unregisterAll();
  }
}
const memorySink = (into) => ({
  write: (bytes, offset) => into.set(bytes, offset)
});
class BFastStreamReader {
  constructor(sinkFor) {
    __publicField(this, "ranges");
    __publicField(this, "sinkFor");
    __publicField(this, "head", []);
    __publicField(this, "headBytes", 0);
    __publicField(this, "position", 0);
    __publicField(this, "targets", []);
    __publicField(this, "first", 0);
    this.sinkFor = sinkFor;
  }
  push(chunk) {
    if (chunk.length === 0)
      return;
    if (this.ranges) {
      this.route(chunk, this.position);
      this.position += chunk.length;
      return;
    }
    this.head.push(chunk);
    this.headBytes += chunk.length;
    const head = this.tryReadHeader();
    if (!head)
      return;
    this.route(head, 0);
    this.position = head.length;
    this.head = [];
  }
  end() {
    if (!this.ranges) {
      throw new Error(
        `The stream ended after ${this.headBytes} bytes, before the BFAST header was complete.`
      );
    }
    for (const t of this.targets)
      t.sink.end?.();
  }
  tryReadHeader() {
    const joined = join(this.head, this.headBytes);
    const needed = bfastHeaderSize(joined.buffer, joined.byteOffset);
    if (needed === void 0 || this.headBytes < needed)
      return void 0;
    this.ranges = readBFastHeader(joined.buffer, joined.byteOffset);
    this.targets = this.ranges.map((range) => ({ range, sink: this.sinkFor(range) })).filter((t) => !!t.sink).sort((a, b) => a.range.begin - b.range.begin);
    return joined;
  }
  route(chunk, start) {
    const end = start + chunk.length;
    while (this.first < this.targets.length && this.targets[this.first].range.end <= start) {
      this.first++;
    }
    for (let i = this.first; i < this.targets.length; i++) {
      const { range, sink } = this.targets[i];
      if (range.begin >= end)
        break;
      const from = Math.max(start, range.begin);
      const to = Math.min(end, range.end);
      if (to > from)
        sink.write(chunk.subarray(from - start, to - start), from - range.begin);
    }
  }
}
async function readBFastStream(chunks, sinkFor) {
  const reader = new BFastStreamReader(sinkFor);
  for await (const chunk of chunks)
    reader.push(chunk);
  reader.end();
  return reader.ranges;
}
const join = (parts, total) => {
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};
export {
  BFastStreamReader as B,
  CameraControls as C,
  CanvasViewport as a,
  memorySink as m,
  readBFastStream as r
};
//# sourceMappingURL=bfastStream.5fe1e8fa.js.map
