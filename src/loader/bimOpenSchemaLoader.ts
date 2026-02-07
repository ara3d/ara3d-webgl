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
    // Use the new-style init signature to avoid the “deprecated parameters” warning.
    // Also, fetch explicitly so we can fail fast with a useful error.
    const resp = await fetch(PARQUET_WASM_URL);
    if (!resp.ok) {
      throw new Error(
        `Failed to fetch parquet-wasm .wasm: ${resp.status} ${resp.statusText} (${PARQUET_WASM_URL})`
      );
    }
    // New signature: pass a single object.
    await wasmInit({ module_or_path: resp });
  })();

  return _parquetInitPromise;
}

// -------------------- helpers --------------------

type TypedArrayCtor =
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Uint8ArrayConstructor
  | Float32ArrayConstructor
  | BigInt64ArrayConstructor
  | BigUint64ArrayConstructor;

function coerceTypedArray(data: any, ctor?: TypedArrayCtor) {
  if (!ctor) return data;
  if (data instanceof ctor) return data;

  // Avoid touching BigInt columns unless you intentionally want typed BigInt arrays
  const first = data?.length ? data[0] : undefined;
  if (typeof first === "bigint") return data;

  // If it's a view over an ArrayBuffer, create a view without copying (when possible)
  if (ArrayBuffer.isView(data) && data.buffer instanceof ArrayBuffer) {
    const bpe = (ctor as any).BYTES_PER_ELEMENT as number | undefined;
    if (bpe && data.byteLength % bpe === 0) {
      return new ctor(data.buffer, data.byteOffset, data.byteLength / bpe);
    }
  }

  // Fallback: this copies (e.g. JS number[])
  return new ctor(data);
}

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
  // Parquet file header should start with "PAR1"
  if (parquetBytes.byteLength < 4) {
    throw new Error(`${debugName}: parquet bytes empty/too small (${parquetBytes.byteLength} bytes)`);
  }
  if (
    parquetBytes[0] !== 0x50 || // P
    parquetBytes[1] !== 0x41 || // A
    parquetBytes[2] !== 0x52 || // R
    parquetBytes[3] !== 0x31    // 1
  ) {
    throw new Error(`${debugName}: not a parquet file (missing PAR1 header)`);
  }

  // Any thrown error here is likely either invalid bytes or wasm init issues.
  const wasmTable = readParquet(parquetBytes);

  // Convert wasm Arrow table -> IPC stream -> JS Arrow table.
  // IMPORTANT: do NOT call wasmTable.free() here; it can invalidate the IPC stream depending on implementation details.
  // If you later confirm it’s safe, you can add cleanup after you fully consume the data.
  return tableFromIPC(wasmTable.intoIPCStream());
}

/**
 * Reads the BOS parquet tables from a JSZip archive into a BimData object using parquet-wasm.
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

    // Unzip -> bytes
    console.time(`zip:${tableName}`);
    const ab = await zip.files[entryName].async("arraybuffer");
    console.timeEnd(`zip:${tableName}`);

    if (ab.byteLength === 0) {
      if (optional) return;
      throw new Error(`${tableName}: zip entry is empty (${entryName})`);
    }

    const bytes = new Uint8Array(ab);

    // Decode parquet -> Arrow
    console.time(`parquet:${tableName}`);
    let arrowTable: ArrowTable;
    try {
      arrowTable = readParquetToArrowTable(bytes, tableName);
    } catch (e: any) {
      // Make the common wasm failure mode actionable.
      const msg = e?.message ?? String(e);
      throw new Error(
        `${tableName}: parquet-wasm failed to decode. ` +
          `Bytes=${bytes.byteLength}. Error=${msg}`
      );
    } finally {
      console.timeEnd(`parquet:${tableName}`);
    }

    // Extract columns
    for (const field of arrowTable.schema.fields) {
      const colName = field.name;
      const col = arrowTable.getChild(colName);
      if (!col) continue;

      // Note: toArray() may allocate/copy. That’s fine for correctness; optimize later if needed.
      let data: any;
      try {
        data = col.toArray();
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        throw new Error(`${tableName}.${colName}: failed converting Arrow column to JS array: ${msg}`);
      }

      target[colName] = coerceTypedArray(data, ctor);
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

  // Strings
  await readParquetTable("Strings", bd);

  console.timeEnd("Reading parquet tables (parquet-wasm)");
  return bd;
}
