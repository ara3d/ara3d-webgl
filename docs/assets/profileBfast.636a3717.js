import "./modulepreload-polyfill.c7c6310f.js";
import { q as isRenderModel, b as BFAST_HEADER_PROBE, r as readBFastHeader, d as readBFast, t as readRenderModel } from "./renderModel.76ea7852.js";
import { h as isWebGpuAvailable, r as requestGpuContext, d as buildGpuSceneFromModel } from "./buildGpuSceneFromModel.4980941e.js";
const DEFAULT = "http://localhost:8099/all.bfast";
const DEFAULT_GZIP = "http://localhost:8100/all.bfast";
const out = document.getElementById("err");
const results = document.getElementById("out");
const urlInput = document.getElementById("url");
const gzipInput = document.getElementById("gzipUrl");
const params = new URLSearchParams(location.search);
urlInput.value = params.get("model") ?? DEFAULT;
gzipInput.value = params.get("gzip") ?? DEFAULT_GZIP;
const MB = (b) => (b / 1048576).toFixed(1);
const now = () => performance.now();
const stage = async (rows, name, bytes, f) => {
  const start = now();
  const value = await f();
  rows.push({ name, ms: now() - start, bytes });
  return value;
};
function table(title, rows) {
  const total = rows.reduce((a, r) => a + r.ms, 0);
  const max = Math.max(...rows.map((r) => r.ms));
  const tr = (r) => `<tr>
    <td>${r.name}</td>
    <td>${r.bytes ? MB(r.bytes) + " MB" : ""}</td>
    <td>${r.ms.toFixed(0)} ms</td>
    <td>${r.bytes ? (r.bytes / 1048576 / (r.ms / 1e3)).toFixed(0) + " MB/s" : ""}</td>
    <td>${(r.ms / total * 100).toFixed(0)}%</td>
    <td><span class="bar" style="width:${(r.ms / max * 160).toFixed(0)}px"></span></td>
  </tr>`;
  results.insertAdjacentHTML("beforeend", `<table>
    <caption>${title}</caption>
    <tr><th>stage</th><th>bytes</th><th>time</th><th>rate</th><th>share</th><th></th></tr>
    ${rows.map(tr).join("")}
    <tr class="total"><td>total</td><td></td><td>${total.toFixed(0)} ms</td><td></td><td></td><td></td></tr>
  </table>`);
  return total;
}
const note = (html) => results.insertAdjacentHTML("beforeend", `<p class="note">${html}</p>`);
const align4 = (n) => n + 3 & ~3;
async function profileWholeFile(url, device) {
  const rows = [];
  const buffer = await stage(rows, "fetch to ArrayBuffer", 0, async () => {
    const r = await fetch(url);
    if (!r.ok)
      throw new Error(`${r.status} ${r.statusText} for ${url}`);
    return r.arrayBuffer();
  });
  rows[0].bytes = buffer.byteLength;
  const bfast = await stage(rows, "parse header", 0, () => readBFast(buffer));
  if (!isRenderModel(bfast))
    throw new Error("not a render model: " + bfast.names.join(", "));
  const model = await stage(rows, "decode render model", 0, () => readRenderModel(bfast));
  const scene = await stage(rows, "build gpu scene", 0, () => buildGpuSceneFromModel(model));
  const uploads = [
    ["vertices", scene.vertices.buffers[0].bytes.data, GPUBufferUsage.VERTEX],
    ["indices", scene.indices.data, GPUBufferUsage.INDEX],
    ["instances", scene.instanceData, GPUBufferUsage.STORAGE],
    ["spheres", scene.instanceSpheres, GPUBufferUsage.STORAGE],
    ["draw commands", scene.drawCommands, GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE]
  ];
  const created = [];
  for (const [name, data, usage] of uploads) {
    await stage(rows, "upload " + name, data.byteLength, async () => {
      const gpu = device.createBuffer({
        size: align4(data.byteLength),
        usage: usage | GPUBufferUsage.COPY_DST
      });
      created.push(gpu);
      device.queue.writeBuffer(gpu, 0, data.buffer, data.byteOffset, data.byteLength);
      await device.queue.onSubmittedWorkDone();
    });
  }
  const stats = {
    draws: scene.drawCommands.length / 5,
    triangles: scene.triangleCount,
    bytes: buffer.byteLength
  };
  for (const b of created)
    b.destroy();
  return { rows, stats };
}
async function profileStreamed(url, device) {
  const rows = [];
  const head = await stage(rows, "fetch header (range)", BFAST_HEADER_PROBE, async () => {
    const r = await fetch(url, { headers: { Range: `bytes=0-${BFAST_HEADER_PROBE - 1}` } });
    if (r.status !== 206)
      throw new Error(`server ignored the range request (${r.status})`);
    return r.arrayBuffer();
  });
  const ranges = await stage(rows, "parse header", 0, () => readBFastHeader(head));
  const geometry = /* @__PURE__ */ new Set(["VertexData", "IndexData"]);
  const created = [];
  for (const r of ranges.filter((r2) => geometry.has(r2.name))) {
    const size = r.end - r.begin;
    await stage(rows, `stream ${r.name}`, size, async () => {
      const gpu = device.createBuffer({
        size: align4(size),
        usage: (r.name === "IndexData" ? GPUBufferUsage.INDEX : GPUBufferUsage.VERTEX) | GPUBufferUsage.COPY_DST
      });
      created.push(gpu);
      await streamInto(device, gpu, url, r.begin, r.end);
      await device.queue.onSubmittedWorkDone();
    });
  }
  const rest = ranges.filter((r) => !geometry.has(r.name));
  const begin = Math.min(...rest.map((r) => r.begin));
  const end = Math.max(...rest.map((r) => r.end));
  await stage(rows, "fetch instance tables (range)", end - begin, async () => {
    const r = await fetch(url, { headers: { Range: `bytes=${begin}-${end - 1}` } });
    return r.arrayBuffer();
  });
  for (const b of created)
    b.destroy();
  return { rows };
}
async function streamInto(device, gpu, url, begin, end) {
  const resp = await fetch(url, { headers: { Range: `bytes=${begin}-${end - 1}` } });
  if (resp.status !== 206)
    throw new Error(`server ignored the range request (${resp.status})`);
  const reader = resp.body.getReader();
  let at = 0;
  let carry = new Uint8Array(0);
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done)
      break;
    let data = value;
    if (carry.length) {
      const joined = new Uint8Array(carry.length + data.length);
      joined.set(carry);
      joined.set(data, carry.length);
      data = joined;
    }
    const whole = data.length & ~3;
    carry = data.subarray(whole);
    if (whole) {
      device.queue.writeBuffer(gpu, at, data.buffer, data.byteOffset, whole);
      at += whole;
    }
  }
  if (carry.length) {
    const padded = new Uint8Array(4);
    padded.set(carry);
    device.queue.writeBuffer(gpu, at, padded);
    at += carry.length;
  }
  if (at !== end - begin)
    throw new Error(`streamed ${at} bytes, expected ${end - begin}`);
}
async function profileGzipStreamed(url, device) {
  const rows = [];
  const start = now();
  const resp = await fetch(url);
  if (!resp.ok)
    throw new Error(`${resp.status} ${resp.statusText} for ${url}`);
  const wireBytes = Number(resp.headers.get("content-length")) || 0;
  rows.push({ name: "response headers", ms: now() - start, bytes: 0 });
  const reader = resp.body.getReader();
  const geometry = /* @__PURE__ */ new Set(["VertexData", "IndexData"]);
  let ranges = null;
  let targets = null;
  const created = [];
  const rest = /* @__PURE__ */ new Map();
  let filePos = 0;
  let prefix = [];
  let prefixBytes = 0;
  let decoded = 0;
  const t1 = now();
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done)
      break;
    decoded += value.length;
    if (!ranges) {
      prefix.push(value);
      prefixBytes += value.length;
      if (prefixBytes < BFAST_HEADER_PROBE)
        continue;
      const head = new Uint8Array(prefixBytes);
      let at = 0;
      for (const p of prefix) {
        head.set(p, at);
        at += p.length;
      }
      ranges = readBFastHeader(head.buffer, head.byteOffset);
      targets = ranges.map((r) => {
        const size = r.end - r.begin;
        if (geometry.has(r.name)) {
          const gpu = device.createBuffer({
            size: align4(size),
            usage: (r.name === "IndexData" ? GPUBufferUsage.INDEX : GPUBufferUsage.VERTEX) | GPUBufferUsage.COPY_DST
          });
          created.push(gpu);
          return { range: r, gpu, carry: new Uint8Array(0), at: 0 };
        }
        const bytes = new Uint8Array(size);
        rest.set(r.name, bytes);
        return { range: r, bytes };
      });
      route(device, targets, head, 0);
      filePos = prefixBytes;
      prefix = null;
      continue;
    }
    route(device, targets, value, filePos);
    filePos += value.length;
  }
  flushCarries(device, targets);
  rows.push({ name: "stream and route to GPU", ms: now() - t1, bytes: decoded });
  const t2 = now();
  await device.queue.onSubmittedWorkDone();
  rows.push({ name: "wait for GPU", ms: now() - t2, bytes: 0 });
  for (const b of created)
    b.destroy();
  return {
    rows,
    note: `Server sent ${MB(wireBytes)} MB on the wire for ${MB(decoded)} MB of data (${(decoded / wireBytes).toFixed(1)}x). ` + (decoded > wireBytes * 1.05 ? "Compression is active." : "No compression: is the .gz present and --gzip enabled?")
  };
}
function route(device, targets, chunk, chunkStart) {
  const chunkEnd = chunkStart + chunk.length;
  for (const t of targets) {
    const from = Math.max(chunkStart, t.range.begin);
    const to = Math.min(chunkEnd, t.range.end);
    if (to <= from)
      continue;
    const piece = chunk.subarray(from - chunkStart, to - chunkStart);
    if (!t.gpu) {
      t.bytes.set(piece, from - t.range.begin);
      continue;
    }
    let data = piece;
    if (t.carry.length) {
      const joined = new Uint8Array(t.carry.length + piece.length);
      joined.set(t.carry);
      joined.set(piece, t.carry.length);
      data = joined;
    }
    const whole = data.length & ~3;
    t.carry = data.subarray(whole);
    if (whole) {
      device.queue.writeBuffer(t.gpu, t.at, data.buffer, data.byteOffset, whole);
      t.at += whole;
    }
  }
}
const flushCarries = (device, targets) => {
  for (const t of targets ?? []) {
    if (!t.gpu || !t.carry.length)
      continue;
    const padded = new Uint8Array(4);
    padded.set(t.carry);
    device.queue.writeBuffer(t.gpu, t.at, padded);
    t.at += t.carry.length;
    t.carry = new Uint8Array(0);
  }
};
async function run() {
  results.innerHTML = "";
  out.textContent = "";
  const url = urlInput.value.trim();
  if (!isWebGpuAvailable()) {
    out.textContent = "WebGPU is not available in this browser.";
    return;
  }
  const { device } = await requestGpuContext();
  const whole = await profileWholeFile(url, device);
  const totalA = table("A. whole file into one ArrayBuffer (what the loader does today)", whole.rows);
  results.insertAdjacentHTML(
    "beforeend",
    `<p class="note">${whole.stats.draws.toLocaleString()} draw commands, ${whole.stats.triangles.toLocaleString()} triangles, ${MB(whole.stats.bytes)} MB file.</p>`
  );
  const streamed = await profileStreamed(url, device);
  const totalB = table("B. range requests streamed straight into GPU buffers", streamed.rows);
  note(`Geometry never lands in a JavaScript array, and the upload overlaps the download. <b>${(totalA / totalB).toFixed(1)}x</b> faster than A here.`);
  const gzipUrl = gzipInput.value.trim();
  if (gzipUrl) {
    const gz = await profileGzipStreamed(gzipUrl, device);
    const totalC = table("C. one gzipped request, decompressed bytes routed into GPU buffers", gz.rows);
    note(`${gz.note} <b>${(totalA / totalC).toFixed(1)}x</b> faster than A, <b>${(totalB / totalC).toFixed(1)}x</b> faster than B here.`);
  }
}
document.getElementById("run").addEventListener(
  "click",
  () => run().catch((e) => {
    out.textContent = String(e.stack ?? e);
  })
);
run().catch((e) => {
  out.textContent = String(e.stack ?? e);
});
//# sourceMappingURL=profileBfast.636a3717.js.map
