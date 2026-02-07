import JSZip from "jszip";
import { tableFromIPC, Table as ArrowTable } from "apache-arrow";
import wasmInit, { readParquet } from "parquet-wasm";

import { BimGeometry } from "./bimGeometry";
import { buildGeometry } from "./buildGeometryGroup";
import { buildInstances } from "./buildInstances";
import { BimData } from "./bimData";
import { BimEntities } from "./bimEntities";
import { BimQuery } from "./bimQuery";
import { BimParameterDescriptors } from "./BimParameterDescriptors";
import { BimParameterTable } from "./BimParameterTable";

export type BimLoaderOptions = {
  loadParameters: boolean;
};

/**
 * Loader that takes a URL to a .ZIP or .BOS file containing BIM Open Schema parquet tables.
 */
export class BimOpenSchemaLoader {
  async load(source: string, options: BimLoaderOptions): Promise<BimData> {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    const bimData = await loadBimGeometryFromZip(zip, options);

    // Post-load derived data
    bimData.Instances = buildInstances(bimData.BimGeometry);
    bimData.Query = new BimQuery(bimData);
    bimData.Resolver = bimData.Query.Resolver;
    bimData.ThreeGeometry = buildGeometry(bimData.Instances);

    return bimData;
  }
}

// -------------------- parquet-wasm init (one-time, robust) --------------------

const PARQUET_WASM_VERSION = "0.7.1";
const PARQUET_WASM_URL = `https://cdn.jsdelivr.net/npm/parquet-wasm@${PARQUET_WASM_VERSION}/esm/parquet_wasm_bg.wasm`;

let _parquetInitPromise: Promise<void> | null = null;

async function ensureParquetWasmInit(): Promise<void> {
  if (_parquetInitPromise) return _parquetInitPromise;

  _parquetInitPromise = (async () => {
    console.info(`[BOS] init parquet-wasm ${PARQUET_WASM_VERSION}`);
    const resp = await fetch(PARQUET_WASM_URL);
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch parquet-wasm .wasm: ${resp.status} ${resp.statusText} (${PARQUET_WASM_URL})`
      );
    }
    await wasmInit({ module_or_path: resp });
    console.info(`[BOS] parquet-wasm ready`);
  })();

  return _parquetInitPromise;
}

// -------------------- logging helpers --------------------

function info(msg: string) {
  console.info(msg);
}
function warn(msg: string) {
  console.warn(msg);
}
function err(msg: string) {
  console.error(msg);
}

function time<T>(label: string, fn: () => T): T {
  console.time(label);
  try {
    return fn();
  } finally {
    console.timeEnd(label);
  }
}

async function timeAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  console.time(label);
  try {
    return await fn();
  } finally {
    console.timeEnd(label);
  }
}

function assertNonEmpty(cond: any, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

// -------------------- helpers --------------------

type TypedArrayCtor =
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Uint8ArrayConstructor
  | Float32ArrayConstructor
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor;

function getZipEntryName(zip: JSZip, suffix: string, optional: boolean): string | null {
  const lowerSuffix = suffix.toLowerCase();
  const name = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(lowerSuffix));
  if (!name) {
    if (optional) return null;
    throw new Error(`Could not find "${suffix}" in zip archive.`);
  }
  return name;
}

/**
 * Converts parquet bytes to an Arrow table using parquet-wasm.
 * Performs early validation to catch “null pointer passed to rust” situations ASAP.
 */
function readParquetToArrowTable(parquetBytes: Uint8Array, debugName: string): ArrowTable {
  assertNonEmpty(parquetBytes?.byteLength >= 4, `${debugName}: parquet bytes empty/too small`);

  // Parquet file header should start with "PAR1"
  if (
    parquetBytes[0] !== 0x50 || // P
    parquetBytes[1] !== 0x41 || // A
    parquetBytes[2] !== 0x52 || // R
    parquetBytes[3] !== 0x31    // 1
  ) {
    throw new Error(`${debugName}: not a parquet file (missing PAR1 header)`);
  }

  const wasmTable = readParquet(parquetBytes);
  return tableFromIPC(wasmTable.intoIPCStream());
}

function isChunkedVector(v: any): boolean {
  // Arrow vectors/columns can expose chunking via:
  //  - v.chunks (Chunked)
  //  - v.data as an array of Data objects (record batches)
  const chunks = Array.isArray(v?.chunks) ? v.chunks.length : 0;
  const datas = Array.isArray(v?.data) ? v.data.length : 0;
  return chunks > 1 || datas > 1;
}

function getVectorChunks(v: any): any[] {
  if (!v) return [];

  // Preferred: explicit chunk vectors
  if (Array.isArray(v.chunks) && v.chunks.length) return v.chunks;

  // Fallback: treat each Data entry as a chunk-like thing by fabricating a minimal wrapper
  // that looks like a Vector for our tryGetZeroCopyValues() (i.e., has data[0]).
  if (Array.isArray(v.data) && v.data.length) {
    return v.data.map((d: any) => ({
      data: [d],
      length: d.length,
      offset: d.offset ?? 0,
      nullCount: d.nullCount ?? 0,
    }));
  }

  // Not chunked
  return [v];
}

function tryGetZeroCopyValues(vector: any): {
  values: ArrayBufferView;
  length: number;
  offset: number;
  nullCount: number;
} | null {
  if (!vector) return null;

  const data0 = vector?.data?.[0];
  const values = data0?.values;

  if (!values || !ArrayBuffer.isView(values)) return null;

  const length = vector.length ?? data0.length ?? 0;
  const offset = vector.offset ?? data0.offset ?? 0;
  const nullCount = vector.nullCount ?? data0.nullCount ?? 0;

  if (typeof length !== "number" || length < 0) return null;
  if (typeof offset !== "number" || offset < 0) return null;

  return { values, length, offset, nullCount };
}

function viewAsTypedArray(
  values: ArrayBufferView,
  ctor: TypedArrayCtor,
  elementOffset: number,
  elementLength: number
): InstanceType<TypedArrayCtor> {
  const bpe = (ctor as any).BYTES_PER_ELEMENT as number;
  if (!bpe || bpe <= 0) throw new Error(`Invalid BYTES_PER_ELEMENT for ${ctor.name}`);

  const buf = (values as any).buffer as ArrayBuffer;
  if (!(buf instanceof ArrayBuffer)) throw new Error(`Arrow values buffer is not an ArrayBuffer`);

  const baseByteOffset = (values as any).byteOffset ?? 0;
  const byteOffset = baseByteOffset + elementOffset * bpe;
  const neededBytes = elementLength * bpe;

  if (byteOffset < 0 || byteOffset + neededBytes > buf.byteLength) {
    throw new Error(
      `Typed view out of range: byteOffset=${byteOffset} needed=${neededBytes} buf=${buf.byteLength}`
    );
  }

  return new (ctor as any)(buf, byteOffset, elementLength);
}

function chunkToTypedView(
  tableName: string,
  colName: string,
  chunk: any,
  ctor: TypedArrayCtor
): InstanceType<TypedArrayCtor> | null {
  const z = tryGetZeroCopyValues(chunk);
  if (!z) return null;

  if (z.nullCount > 0) {
    console.warn(
      `[BOS] ${tableName}.${colName}: chunk has nullCount=${z.nullCount} (typed view ignores validity bitmap)`
    );
  }

  // Best case: Arrow already gives us the right typed array type
  if (z.values instanceof ctor) {
    const v = z.values as any;
    if (typeof v.subarray === "function") return v.subarray(z.offset, z.offset + z.length);
    return viewAsTypedArray(z.values, ctor, z.offset, z.length);
  }

  // Otherwise, reinterpret as ctor (still zero-copy, but only safe when element sizing matches)
  try {
    return viewAsTypedArray(z.values, ctor, z.offset, z.length);
  } catch (e: any) {
    console.warn(
      `[BOS] ${tableName}.${colName}: chunk reinterpret failed (${e?.message ?? e})`
    );
    return null;
  }
}

/**
 * Chunk-aware conversion:
 * - 1 chunk => zero-copy view
 * - N chunks => single allocation + copy from chunk views (no JS number[] materialization)
 */
function columnToTypedArray(
  tableName: string,
  colName: string,
  col: any,
  ctor?: TypedArrayCtor
): any {
  // If no ctor requested, keep previous behavior (we *could* chunk-stitch too,
  // but strings/variable width often won't be in values buffers).
  if (!ctor) {
    // Try fast path for primitive non-chunked
    const z = !isChunkedVector(col) ? tryGetZeroCopyValues(col) : null;
    if (z) {
      const v: any = z.values;
      if (typeof v.subarray === "function") return v.subarray(z.offset, z.offset + z.length);
      return z.values;
    }
    console.warn(`[BOS] ${tableName}.${colName}: falling back to toArray() (no ctor)`);
    return col.toArray();
  }

  // --- Chunked columns (this is your current problem) ---
  if (isChunkedVector(col)) {
  const chunks = getVectorChunks(col);
  const totalLen = col.length ?? chunks.reduce((s, c) => s + (c.length ?? 0), 0);

  console.info(
    `[BOS] ${tableName}.${colName}: chunked column chunks=${chunks.length} totalLen=${totalLen}`
  );

  if (chunks.length === 1) {
    const v = chunkToTypedView(tableName, colName, chunks[0], ctor);
    if (v && v.length === totalLen) return v;
    console.warn(`[BOS] ${tableName}.${colName}: 1-chunk view failed; falling back to toArray()`);
    const arr = col.toArray();
    return new (ctor as any)(arr);
  }

  const out = new (ctor as any)(totalLen) as InstanceType<TypedArrayCtor>;
  let write = 0;

  for (let i = 0; i < chunks.length; i++) {
    const view = chunkToTypedView(tableName, colName, chunks[i], ctor);
    if (!view) {
      console.warn(
        `[BOS] ${tableName}.${colName}: chunk ${i}/${chunks.length} not viewable; falling back to toArray()`
      );
      const arr = col.toArray();
      return new (ctor as any)(arr);
    }

    if (write + view.length > out.length) {
      throw new Error(
        `${tableName}.${colName}: stitching overflow write=${write} view=${view.length} out=${out.length}`
      );
    }

    (out as any).set(view, write);
    write += view.length;
  }

  if (write !== out.length) {
    console.warn(
      `[BOS] ${tableName}.${colName}: stitched length mismatch write=${write} out=${out.length}`
    );
  }

  return out;
}

  // --- Non-chunked columns ---
  const single = chunkToTypedView(tableName, colName, col, ctor);
  if (single) return single;

  // Fallback: may allocate/copy (still correct)
  console.warn(`[BOS] ${tableName}.${colName}: non-chunked view failed; falling back to toArray()`);
  const arr = col.toArray();
  const first = arr?.length ? arr[0] : undefined;
  if (typeof first === "bigint") return arr; // preserve BigInt columns
  return new (ctor as any)(arr);
}


/**
 * Reads the BOS parquet tables from a JSZip archive into a BimData object using parquet-wasm.
 * Optimized to avoid copies when extracting Arrow columns.
 */
export async function loadBimGeometryFromZip(
  zip: JSZip,
  options: BimLoaderOptions
): Promise<BimData> {
  await ensureParquetWasmInit();

  async function readParquetTable(
    tableName: string,
    target: any,
    ctor?: TypedArrayCtor,
    optional = false
  ): Promise<void> {
    const entryName = getZipEntryName(zip, `${tableName}.parquet`, optional);
    if (!entryName) return;

    const ab = await timeAsync(`zip:${tableName}`, () =>
      zip.files[entryName].async("arraybuffer")
    );

    if (ab.byteLength === 0) {
      if (optional) return;
      throw new Error(`${tableName}: zip entry is empty (${entryName})`);
    }

    const bytes = new Uint8Array(ab);

    const arrowTable = time(`parquet:${tableName}`, () => {
      try {
        return readParquetToArrowTable(bytes, tableName);
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        throw new Error(
          `${tableName}: parquet-wasm failed to decode. Bytes=${bytes.byteLength}. Error=${msg}`
        );
      }
    });

    assertNonEmpty(arrowTable?.schema?.fields?.length >= 0, `${tableName}: invalid Arrow table`);

    info(`[BOS] ${tableName}: columns=${arrowTable.schema.fields.length} rows=${arrowTable.numRows}`);

    for (const field of arrowTable.schema.fields) {
      const colName = field.name;
      const col = arrowTable.getChild(colName);
      if (!col) {
        warn(`[BOS] ${tableName}.${colName}: missing column`);
        continue;
      }

      try {
        const value = columnToTypedArray(tableName, colName, col, ctor);

        // Defensive checks for typed array expectations
        if (ctor) {
          if (!(value instanceof ctor)) {
            warn(
              `[BOS] ${tableName}.${colName}: expected ${ctor.name}, got ${value?.constructor?.name ?? typeof value}`
            );
          } else if ((value as any).length !== col.length) {
            warn(
              `[BOS] ${tableName}.${colName}: length mismatch typed=${(value as any).length} arrow=${col.length}`
            );
          }
        }

        target[colName] = value;
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        err(`[BOS] ${tableName}.${colName}: failed to extract column: ${msg}`);
        throw new Error(`${tableName}.${colName}: failed to extract column: ${msg}`);
      }
    }
  }

  console.time("Reading parquet tables (parquet-wasm)");

  const bd = new BimData();
  const bg: any = {};

  // Geometry
  await readParquetTable("Instances", bg, Int32Array);
  await readParquetTable("VertexBuffer", bg, Int32Array);
  await readParquetTable("IndexBuffer", bg, Uint32Array);
  await readParquetTable("Meshes", bg, Int32Array);
  await readParquetTable("Materials", bg, Uint8Array);
  await readParquetTable("Transforms", bg, Float32Array);
  bd.BimGeometry = bg as BimGeometry;

  // Entities
  bd.Entities = {} as BimEntities;
  await readParquetTable("Entities", bd.Entities, Int32Array);

  // Parameters (optional)
  if (options?.loadParameters) {
    bd.Descriptors = {} as BimParameterDescriptors;
    bd.IntegerParameters = {} as BimParameterTable;
    bd.SingleParameters = {} as BimParameterTable;
    bd.StringParameters = {} as BimParameterTable;
    bd.EntityParameters = {} as BimParameterTable;
    bd.PointParameters = {} as BimParameterTable;

    await readParquetTable("Descriptors", bd.Descriptors);
    await readParquetTable("IntegerParameters", bd.IntegerParameters, Int32Array);
    await readParquetTable("SingleParameters", bd.SingleParameters, Int32Array);
    await readParquetTable("StringParameters", bd.StringParameters, Int32Array);
    await readParquetTable("EntityParameters", bd.EntityParameters, Int32Array);
    await readParquetTable("PointParameters", bd.PointParameters, Int32Array);
  }

  // Strings (likely not typed; still tries to avoid copies when possible)
  await readParquetTable("Strings", bd);

  console.timeEnd("Reading parquet tables (parquet-wasm)");
  return bd;
}
