var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { M as Matrix4, a4 as BufferGeometry, a as BufferAttribute, k as MeshStandardMaterial, C as Color, D as DoubleSide, V as Vector3, Q as Quaternion, aq as WorkerWrapper, ar as perfNow, a6 as Group, as as perfDuration, at as perfLongTask, e as Mesh, I as InstancedMesh, au as StaticDrawUsage, av as WorkerWrapper$1, A as MeshBasicMaterial, J as InstancedBufferAttribute, aw as Matrix3, ax as Float32BufferAttribute, ay as DataTexture, az as RGBAFormat, aA as UnsignedByteType, a0 as NearestFilter, aB as JSZip, aC as WorkerWrapper$2, aD as WorkerWrapper$3, aE as compressors } from "./bvhPrecompute.worker.858fae95.js";
const ParquetTypes = [
  "BOOLEAN",
  "INT32",
  "INT64",
  "INT96",
  "FLOAT",
  "DOUBLE",
  "BYTE_ARRAY",
  "FIXED_LEN_BYTE_ARRAY"
];
const Encodings = [
  "PLAIN",
  "GROUP_VAR_INT",
  "PLAIN_DICTIONARY",
  "RLE",
  "BIT_PACKED",
  "DELTA_BINARY_PACKED",
  "DELTA_LENGTH_BYTE_ARRAY",
  "DELTA_BYTE_ARRAY",
  "RLE_DICTIONARY",
  "BYTE_STREAM_SPLIT"
];
const FieldRepetitionTypes = [
  "REQUIRED",
  "OPTIONAL",
  "REPEATED"
];
const ConvertedTypes = [
  "UTF8",
  "MAP",
  "MAP_KEY_VALUE",
  "LIST",
  "ENUM",
  "DECIMAL",
  "DATE",
  "TIME_MILLIS",
  "TIME_MICROS",
  "TIMESTAMP_MILLIS",
  "TIMESTAMP_MICROS",
  "UINT_8",
  "UINT_16",
  "UINT_32",
  "UINT_64",
  "INT_8",
  "INT_16",
  "INT_32",
  "INT_64",
  "JSON",
  "BSON",
  "INTERVAL"
];
const CompressionCodecs = [
  "UNCOMPRESSED",
  "SNAPPY",
  "GZIP",
  "LZO",
  "BROTLI",
  "LZ4",
  "ZSTD",
  "LZ4_RAW"
];
const PageTypes = [
  "DATA_PAGE",
  "INDEX_PAGE",
  "DICTIONARY_PAGE",
  "DATA_PAGE_V2"
];
const EdgeInterpolationAlgorithms = [
  "SPHERICAL",
  "VINCENTY",
  "THOMAS",
  "ANDOYER",
  "KARNEY"
];
function wkbToGeojson(reader) {
  const flags = getFlags(reader);
  if (flags.type === 1) {
    return { type: "Point", coordinates: readPosition(reader, flags) };
  } else if (flags.type === 2) {
    return { type: "LineString", coordinates: readLine(reader, flags) };
  } else if (flags.type === 3) {
    return { type: "Polygon", coordinates: readPolygon(reader, flags) };
  } else if (flags.type === 4) {
    const points = [];
    for (let i = 0; i < flags.count; i++) {
      points.push(readPosition(reader, getFlags(reader)));
    }
    return { type: "MultiPoint", coordinates: points };
  } else if (flags.type === 5) {
    const lines = [];
    for (let i = 0; i < flags.count; i++) {
      lines.push(readLine(reader, getFlags(reader)));
    }
    return { type: "MultiLineString", coordinates: lines };
  } else if (flags.type === 6) {
    const polygons = [];
    for (let i = 0; i < flags.count; i++) {
      polygons.push(readPolygon(reader, getFlags(reader)));
    }
    return { type: "MultiPolygon", coordinates: polygons };
  } else if (flags.type === 7) {
    const geometries = [];
    for (let i = 0; i < flags.count; i++) {
      geometries.push(wkbToGeojson(reader));
    }
    return { type: "GeometryCollection", geometries };
  } else {
    throw new Error(`Unsupported geometry type: ${flags.type}`);
  }
}
function getFlags(reader) {
  const { view } = reader;
  const littleEndian = view.getUint8(reader.offset++) === 1;
  const rawType = view.getUint32(reader.offset, littleEndian);
  reader.offset += 4;
  const type = rawType % 1e3;
  const flags = Math.floor(rawType / 1e3);
  let count = 0;
  if (type > 1 && type <= 7) {
    count = view.getUint32(reader.offset, littleEndian);
    reader.offset += 4;
  }
  let dim = 2;
  if (flags)
    dim++;
  if (flags === 3)
    dim++;
  return { littleEndian, type, dim, count };
}
function readPosition(reader, flags) {
  const points = [];
  for (let i = 0; i < flags.dim; i++) {
    const coord = reader.view.getFloat64(reader.offset, flags.littleEndian);
    reader.offset += 8;
    points.push(coord);
  }
  return points;
}
function readLine(reader, flags) {
  const points = [];
  for (let i = 0; i < flags.count; i++) {
    points.push(readPosition(reader, flags));
  }
  return points;
}
function readPolygon(reader, flags) {
  const { view } = reader;
  const rings = [];
  for (let r = 0; r < flags.count; r++) {
    const count = view.getUint32(reader.offset, flags.littleEndian);
    reader.offset += 4;
    rings.push(readLine(reader, { ...flags, count }));
  }
  return rings;
}
const decoder$1 = new TextDecoder();
const DEFAULT_PARSERS = {
  timestampFromMilliseconds(millis) {
    return new Date(Number(millis));
  },
  timestampFromMicroseconds(micros) {
    return new Date(Number(micros / 1000n));
  },
  timestampFromNanoseconds(nanos) {
    return new Date(Number(nanos / 1000000n));
  },
  dateFromDays(days) {
    return new Date(days * 864e5);
  },
  stringFromBytes(bytes) {
    return bytes && decoder$1.decode(bytes);
  },
  geometryFromBytes(bytes) {
    return bytes && wkbToGeojson({ view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), offset: 0 });
  },
  geographyFromBytes(bytes) {
    return bytes && wkbToGeojson({ view: new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), offset: 0 });
  }
};
function convertWithDictionary(data, dictionary, encoding, columnDecoder) {
  if (dictionary && encoding.endsWith("_DICTIONARY")) {
    let output = data;
    if (data instanceof Uint8Array && !(dictionary instanceof Uint8Array)) {
      output = new dictionary.constructor(data.length);
    }
    for (let i = 0; i < data.length; i++) {
      output[i] = dictionary[data[i]];
    }
    return output;
  } else {
    return convert(data, columnDecoder);
  }
}
function convert(data, columnDecoder) {
  const { element, parsers, utf8 = true } = columnDecoder;
  const { type, converted_type: ctype, logical_type: ltype } = element;
  if (ctype === "DECIMAL") {
    const scale = element.scale || 0;
    const factor = 10 ** -scale;
    const arr = new Array(data.length);
    for (let i = 0; i < arr.length; i++) {
      if (data[i] instanceof Uint8Array) {
        arr[i] = parseDecimal(data[i]) * factor;
      } else {
        arr[i] = Number(data[i]) * factor;
      }
    }
    return arr;
  }
  if (!ctype && type === "INT96") {
    return Array.from(data).map((v) => parsers.timestampFromNanoseconds(parseInt96Nanos(v)));
  }
  if (ctype === "DATE") {
    return Array.from(data).map((v) => parsers.dateFromDays(v));
  }
  if (ctype === "TIMESTAMP_MILLIS") {
    return Array.from(data).map((v) => parsers.timestampFromMilliseconds(v));
  }
  if (ctype === "TIMESTAMP_MICROS") {
    return Array.from(data).map((v) => parsers.timestampFromMicroseconds(v));
  }
  if (ctype === "JSON") {
    return data.map((v) => JSON.parse(decoder$1.decode(v)));
  }
  if (ctype === "BSON") {
    throw new Error("parquet bson not supported");
  }
  if (ctype === "INTERVAL") {
    throw new Error("parquet interval not supported");
  }
  if (ltype?.type === "GEOMETRY") {
    return data.map((v) => parsers.geometryFromBytes(v));
  }
  if (ltype?.type === "GEOGRAPHY") {
    return data.map((v) => parsers.geographyFromBytes(v));
  }
  if (ctype === "UTF8" || ltype?.type === "STRING" || utf8 && type === "BYTE_ARRAY") {
    return data.map((v) => parsers.stringFromBytes(v));
  }
  if (ctype === "UINT_64" || ltype?.type === "INTEGER" && ltype.bitWidth === 64 && !ltype.isSigned) {
    if (data instanceof BigInt64Array) {
      return new BigUint64Array(data.buffer, data.byteOffset, data.length);
    }
    const arr = new BigUint64Array(data.length);
    for (let i = 0; i < arr.length; i++)
      arr[i] = BigInt(data[i]);
    return arr;
  }
  if (ctype === "UINT_32" || ltype?.type === "INTEGER" && ltype.bitWidth === 32 && !ltype.isSigned) {
    if (data instanceof Int32Array) {
      return new Uint32Array(data.buffer, data.byteOffset, data.length);
    }
    const arr = new Uint32Array(data.length);
    for (let i = 0; i < arr.length; i++)
      arr[i] = data[i];
    return arr;
  }
  if (ltype?.type === "FLOAT16") {
    return Array.from(data).map(parseFloat16);
  }
  if (ltype?.type === "TIMESTAMP") {
    const { unit } = ltype;
    let parser = parsers.timestampFromMilliseconds;
    if (unit === "MICROS")
      parser = parsers.timestampFromMicroseconds;
    if (unit === "NANOS")
      parser = parsers.timestampFromNanoseconds;
    const arr = new Array(data.length);
    for (let i = 0; i < arr.length; i++) {
      arr[i] = parser(data[i]);
    }
    return arr;
  }
  return data;
}
function parseDecimal(bytes) {
  if (!bytes.length)
    return 0;
  let value = 0n;
  for (const byte of bytes) {
    value = value * 256n + BigInt(byte);
  }
  const bits = bytes.length * 8;
  if (value >= 2n ** BigInt(bits - 1)) {
    value -= 2n ** BigInt(bits);
  }
  return Number(value);
}
function parseInt96Nanos(value) {
  const days = (value >> 64n) - 2440588n;
  const nano = value & 0xffffffffffffffffn;
  return days * 86400000000000n + nano;
}
function parseFloat16(bytes) {
  if (!bytes)
    return void 0;
  const int16 = bytes[1] << 8 | bytes[0];
  const sign = int16 >> 15 ? -1 : 1;
  const exp = int16 >> 10 & 31;
  const frac = int16 & 1023;
  if (exp === 0)
    return sign * 2 ** -14 * (frac / 1024);
  if (exp === 31)
    return frac ? NaN : sign * Infinity;
  return sign * 2 ** (exp - 15) * (1 + frac / 1024);
}
function schemaTree(schema, rootIndex, path) {
  const element = schema[rootIndex];
  const children = [];
  let count = 1;
  if (element.num_children) {
    while (children.length < element.num_children) {
      const childElement = schema[rootIndex + count];
      const child = schemaTree(schema, rootIndex + count, [...path, childElement.name]);
      count += child.count;
      children.push(child);
    }
  }
  return { count, element, children, path };
}
function getSchemaPath(schema, name) {
  let tree = schemaTree(schema, 0, []);
  const path = [tree];
  for (const part of name) {
    const child = tree.children.find((child2) => child2.element.name === part);
    if (!child)
      throw new Error(`parquet schema element not found: ${name}`);
    path.push(child);
    tree = child;
  }
  return path;
}
function getPhysicalColumns(schemaTree2) {
  const columns = [];
  function traverse(node) {
    if (node.children.length) {
      for (const child of node.children) {
        traverse(child);
      }
    } else {
      columns.push(node.element.name);
    }
  }
  traverse(schemaTree2);
  return columns;
}
function getMaxRepetitionLevel(schemaPath) {
  let maxLevel = 0;
  for (const { element } of schemaPath) {
    if (element.repetition_type === "REPEATED") {
      maxLevel++;
    }
  }
  return maxLevel;
}
function getMaxDefinitionLevel(schemaPath) {
  let maxLevel = 0;
  for (const { element } of schemaPath.slice(1)) {
    if (element.repetition_type !== "REQUIRED") {
      maxLevel++;
    }
  }
  return maxLevel;
}
function isListLike(schema) {
  if (!schema)
    return false;
  if (schema.element.converted_type !== "LIST")
    return false;
  if (schema.children.length > 1)
    return false;
  const firstChild = schema.children[0];
  if (firstChild.children.length > 1)
    return false;
  if (firstChild.element.repetition_type !== "REPEATED")
    return false;
  return true;
}
function isMapLike(schema) {
  if (!schema)
    return false;
  if (schema.element.converted_type !== "MAP")
    return false;
  if (schema.children.length > 1)
    return false;
  const firstChild = schema.children[0];
  if (firstChild.children.length !== 2)
    return false;
  if (firstChild.element.repetition_type !== "REPEATED")
    return false;
  const keyChild = firstChild.children.find((child) => child.element.name === "key");
  if (keyChild?.element.repetition_type === "REPEATED")
    return false;
  const valueChild = firstChild.children.find((child) => child.element.name === "value");
  if (valueChild?.element.repetition_type === "REPEATED")
    return false;
  return true;
}
function isFlatColumn(schemaPath) {
  if (schemaPath.length !== 2)
    return false;
  const [, column] = schemaPath;
  if (column.element.repetition_type === "REPEATED")
    return false;
  if (column.children.length)
    return false;
  return true;
}
const CompactType = {
  STOP: 0,
  TRUE: 1,
  FALSE: 2,
  BYTE: 3,
  I16: 4,
  I32: 5,
  I64: 6,
  DOUBLE: 7,
  BINARY: 8,
  LIST: 9,
  SET: 10,
  MAP: 11,
  STRUCT: 12,
  UUID: 13
};
function deserializeTCompactProtocol(reader) {
  let lastFid = 0;
  const value = {};
  while (reader.offset < reader.view.byteLength) {
    const [type, fid, newLastFid] = readFieldBegin(reader, lastFid);
    lastFid = newLastFid;
    if (type === CompactType.STOP) {
      break;
    }
    value[`field_${fid}`] = readElement(reader, type);
  }
  return value;
}
function readElement(reader, type) {
  switch (type) {
    case CompactType.TRUE:
      return true;
    case CompactType.FALSE:
      return false;
    case CompactType.BYTE:
      return reader.view.getInt8(reader.offset++);
    case CompactType.I16:
    case CompactType.I32:
      return readZigZag(reader);
    case CompactType.I64:
      return readZigZagBigInt(reader);
    case CompactType.DOUBLE: {
      const value = reader.view.getFloat64(reader.offset, true);
      reader.offset += 8;
      return value;
    }
    case CompactType.BINARY: {
      const stringLength = readVarInt(reader);
      const strBytes = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, stringLength);
      reader.offset += stringLength;
      return strBytes;
    }
    case CompactType.LIST: {
      const byte = reader.view.getUint8(reader.offset++);
      const elemType = byte & 15;
      let listSize = byte >> 4;
      if (listSize === 15) {
        listSize = readVarInt(reader);
      }
      const boolType = elemType === CompactType.TRUE || elemType === CompactType.FALSE;
      const values = new Array(listSize);
      for (let i = 0; i < listSize; i++) {
        values[i] = boolType ? readElement(reader, CompactType.BYTE) === 1 : readElement(reader, elemType);
      }
      return values;
    }
    case CompactType.STRUCT: {
      const structValues = {};
      let lastFid = 0;
      while (true) {
        const [fieldType, fid, newLastFid] = readFieldBegin(reader, lastFid);
        lastFid = newLastFid;
        if (fieldType === CompactType.STOP) {
          break;
        }
        structValues[`field_${fid}`] = readElement(reader, fieldType);
      }
      return structValues;
    }
    default:
      throw new Error(`thrift unhandled type: ${type}`);
  }
}
function readVarInt(reader) {
  let result = 0;
  let shift = 0;
  while (true) {
    const byte = reader.view.getUint8(reader.offset++);
    result |= (byte & 127) << shift;
    if (!(byte & 128)) {
      return result;
    }
    shift += 7;
  }
}
function readVarBigInt(reader) {
  let result = 0n;
  let shift = 0n;
  while (true) {
    const byte = reader.view.getUint8(reader.offset++);
    result |= BigInt(byte & 127) << shift;
    if (!(byte & 128)) {
      return result;
    }
    shift += 7n;
  }
}
function readZigZag(reader) {
  const zigzag = readVarInt(reader);
  return zigzag >>> 1 ^ -(zigzag & 1);
}
function readZigZagBigInt(reader) {
  const zigzag = readVarBigInt(reader);
  return zigzag >> 1n ^ -(zigzag & 1n);
}
function readFieldBegin(reader, lastFid) {
  const byte = reader.view.getUint8(reader.offset++);
  const type = byte & 15;
  if (type === CompactType.STOP) {
    return [0, 0, lastFid];
  }
  const delta = byte >> 4;
  const fid = delta ? lastFid + delta : readZigZag(reader);
  return [type, fid, fid];
}
function markGeoColumns(schema, key_value_metadata) {
  const columns = /* @__PURE__ */ new Map();
  const geo = key_value_metadata?.find(({ key }) => key === "geo")?.value;
  const decodedColumns = (geo && JSON.parse(geo)?.columns) ?? {};
  for (const [name, column] of Object.entries(decodedColumns)) {
    if (column.encoding !== "WKB") {
      continue;
    }
    const type = column.edges === "spherical" ? "GEOGRAPHY" : "GEOMETRY";
    const id = column.crs?.id ?? column.crs?.ids?.[0];
    const crs = id ? `${id.authority}:${id.code.toString()}` : void 0;
    columns.set(name, { type, crs });
  }
  for (let i = 1; i < schema.length; i++) {
    const element = schema[i];
    const { logical_type, name, num_children, repetition_type, type } = element;
    if (num_children) {
      i += num_children;
      continue;
    }
    if (type === "BYTE_ARRAY" && logical_type === void 0 && repetition_type !== "REPEATED") {
      element.logical_type = columns.get(name);
    }
  }
}
const defaultInitialFetchSize = 1 << 19;
const decoder = new TextDecoder();
function decode(value) {
  return value && decoder.decode(value);
}
async function parquetMetadataAsync(asyncBuffer, { parsers, initialFetchSize = defaultInitialFetchSize, geoparquet = true } = {}) {
  if (!asyncBuffer || !(asyncBuffer.byteLength >= 0))
    throw new Error("parquet expected AsyncBuffer");
  const footerOffset = Math.max(0, asyncBuffer.byteLength - initialFetchSize);
  const footerBuffer = await asyncBuffer.slice(footerOffset, asyncBuffer.byteLength);
  const footerView = new DataView(footerBuffer);
  if (footerView.getUint32(footerBuffer.byteLength - 4, true) !== 827474256) {
    throw new Error("parquet file invalid (footer != PAR1)");
  }
  const metadataLength = footerView.getUint32(footerBuffer.byteLength - 8, true);
  if (metadataLength > asyncBuffer.byteLength - 8) {
    throw new Error(`parquet metadata length ${metadataLength} exceeds available buffer ${asyncBuffer.byteLength - 8}`);
  }
  if (metadataLength + 8 > initialFetchSize) {
    const metadataOffset = asyncBuffer.byteLength - metadataLength - 8;
    const metadataBuffer = await asyncBuffer.slice(metadataOffset, footerOffset);
    const combinedBuffer = new ArrayBuffer(metadataLength + 8);
    const combinedView = new Uint8Array(combinedBuffer);
    combinedView.set(new Uint8Array(metadataBuffer));
    combinedView.set(new Uint8Array(footerBuffer), footerOffset - metadataOffset);
    return parquetMetadata(combinedBuffer, { parsers, geoparquet });
  } else {
    return parquetMetadata(footerBuffer, { parsers, geoparquet });
  }
}
function parquetMetadata(arrayBuffer, { parsers, geoparquet = true } = {}) {
  if (!(arrayBuffer instanceof ArrayBuffer))
    throw new Error("parquet expected ArrayBuffer");
  const view = new DataView(arrayBuffer);
  parsers = { ...DEFAULT_PARSERS, ...parsers };
  if (view.byteLength < 8) {
    throw new Error("parquet file is too short");
  }
  if (view.getUint32(view.byteLength - 4, true) !== 827474256) {
    throw new Error("parquet file invalid (footer != PAR1)");
  }
  const metadataLengthOffset = view.byteLength - 8;
  const metadataLength = view.getUint32(metadataLengthOffset, true);
  if (metadataLength > view.byteLength - 8) {
    throw new Error(`parquet metadata length ${metadataLength} exceeds available buffer ${view.byteLength - 8}`);
  }
  const metadataOffset = metadataLengthOffset - metadataLength;
  const reader = { view, offset: metadataOffset };
  const metadata = deserializeTCompactProtocol(reader);
  const version = metadata.field_1;
  const schema = metadata.field_2.map((field) => ({
    type: ParquetTypes[field.field_1],
    type_length: field.field_2,
    repetition_type: FieldRepetitionTypes[field.field_3],
    name: decode(field.field_4),
    num_children: field.field_5,
    converted_type: ConvertedTypes[field.field_6],
    scale: field.field_7,
    precision: field.field_8,
    field_id: field.field_9,
    logical_type: logicalType(field.field_10)
  }));
  const columnSchema = schema.filter((e) => e.type);
  const num_rows = metadata.field_3;
  const row_groups = metadata.field_4.map((rowGroup) => ({
    columns: rowGroup.field_1.map((column, columnIndex) => ({
      file_path: decode(column.field_1),
      file_offset: column.field_2,
      meta_data: column.field_3 && {
        type: ParquetTypes[column.field_3.field_1],
        encodings: column.field_3.field_2?.map((e) => Encodings[e]),
        path_in_schema: column.field_3.field_3.map(decode),
        codec: CompressionCodecs[column.field_3.field_4],
        num_values: column.field_3.field_5,
        total_uncompressed_size: column.field_3.field_6,
        total_compressed_size: column.field_3.field_7,
        key_value_metadata: column.field_3.field_8?.map((kv) => ({
          key: decode(kv.field_1),
          value: decode(kv.field_2)
        })),
        data_page_offset: column.field_3.field_9,
        index_page_offset: column.field_3.field_10,
        dictionary_page_offset: column.field_3.field_11,
        statistics: convertStats(column.field_3.field_12, columnSchema[columnIndex], parsers),
        encoding_stats: column.field_3.field_13?.map((encodingStat) => ({
          page_type: PageTypes[encodingStat.field_1],
          encoding: Encodings[encodingStat.field_2],
          count: encodingStat.field_3
        })),
        bloom_filter_offset: column.field_3.field_14,
        bloom_filter_length: column.field_3.field_15,
        size_statistics: column.field_3.field_16 && {
          unencoded_byte_array_data_bytes: column.field_3.field_16.field_1,
          repetition_level_histogram: column.field_3.field_16.field_2,
          definition_level_histogram: column.field_3.field_16.field_3
        },
        geospatial_statistics: column.field_3.field_17 && {
          bbox: column.field_3.field_17.field_1 && {
            xmin: column.field_3.field_17.field_1.field_1,
            xmax: column.field_3.field_17.field_1.field_2,
            ymin: column.field_3.field_17.field_1.field_3,
            ymax: column.field_3.field_17.field_1.field_4,
            zmin: column.field_3.field_17.field_1.field_5,
            zmax: column.field_3.field_17.field_1.field_6,
            mmin: column.field_3.field_17.field_1.field_7,
            mmax: column.field_3.field_17.field_1.field_8
          },
          geospatial_types: column.field_3.field_17.field_2
        }
      },
      offset_index_offset: column.field_4,
      offset_index_length: column.field_5,
      column_index_offset: column.field_6,
      column_index_length: column.field_7,
      crypto_metadata: column.field_8,
      encrypted_column_metadata: column.field_9
    })),
    total_byte_size: rowGroup.field_2,
    num_rows: rowGroup.field_3,
    sorting_columns: rowGroup.field_4?.map((sortingColumn) => ({
      column_idx: sortingColumn.field_1,
      descending: sortingColumn.field_2,
      nulls_first: sortingColumn.field_3
    })),
    file_offset: rowGroup.field_5,
    total_compressed_size: rowGroup.field_6,
    ordinal: rowGroup.field_7
  }));
  const key_value_metadata = metadata.field_5?.map((kv) => ({
    key: decode(kv.field_1),
    value: decode(kv.field_2)
  }));
  const created_by = decode(metadata.field_6);
  if (geoparquet) {
    markGeoColumns(schema, key_value_metadata);
  }
  return {
    version,
    schema,
    num_rows,
    row_groups,
    key_value_metadata,
    created_by,
    metadata_length: metadataLength
  };
}
function parquetSchema({ schema }) {
  return getSchemaPath(schema, [])[0];
}
function logicalType(logicalType2) {
  if (logicalType2?.field_1)
    return { type: "STRING" };
  if (logicalType2?.field_2)
    return { type: "MAP" };
  if (logicalType2?.field_3)
    return { type: "LIST" };
  if (logicalType2?.field_4)
    return { type: "ENUM" };
  if (logicalType2?.field_5)
    return {
      type: "DECIMAL",
      scale: logicalType2.field_5.field_1,
      precision: logicalType2.field_5.field_2
    };
  if (logicalType2?.field_6)
    return { type: "DATE" };
  if (logicalType2?.field_7)
    return {
      type: "TIME",
      isAdjustedToUTC: logicalType2.field_7.field_1,
      unit: timeUnit(logicalType2.field_7.field_2)
    };
  if (logicalType2?.field_8)
    return {
      type: "TIMESTAMP",
      isAdjustedToUTC: logicalType2.field_8.field_1,
      unit: timeUnit(logicalType2.field_8.field_2)
    };
  if (logicalType2?.field_10)
    return {
      type: "INTEGER",
      bitWidth: logicalType2.field_10.field_1,
      isSigned: logicalType2.field_10.field_2
    };
  if (logicalType2?.field_11)
    return { type: "NULL" };
  if (logicalType2?.field_12)
    return { type: "JSON" };
  if (logicalType2?.field_13)
    return { type: "BSON" };
  if (logicalType2?.field_14)
    return { type: "UUID" };
  if (logicalType2?.field_15)
    return { type: "FLOAT16" };
  if (logicalType2?.field_16)
    return {
      type: "VARIANT",
      specification_version: logicalType2.field_16.field_1
    };
  if (logicalType2?.field_17)
    return {
      type: "GEOMETRY",
      crs: decode(logicalType2.field_17.field_1)
    };
  if (logicalType2?.field_18)
    return {
      type: "GEOGRAPHY",
      crs: decode(logicalType2.field_18.field_1),
      algorithm: EdgeInterpolationAlgorithms[logicalType2.field_18.field_2]
    };
  return logicalType2;
}
function timeUnit(unit) {
  if (unit.field_1)
    return "MILLIS";
  if (unit.field_2)
    return "MICROS";
  if (unit.field_3)
    return "NANOS";
  throw new Error("parquet time unit required");
}
function convertStats(stats, schema, parsers) {
  return stats && {
    max: convertMetadata(stats.field_1, schema, parsers),
    min: convertMetadata(stats.field_2, schema, parsers),
    null_count: stats.field_3,
    distinct_count: stats.field_4,
    max_value: convertMetadata(stats.field_5, schema, parsers),
    min_value: convertMetadata(stats.field_6, schema, parsers),
    is_max_value_exact: stats.field_7,
    is_min_value_exact: stats.field_8
  };
}
function convertMetadata(value, schema, parsers) {
  const { type, converted_type, logical_type } = schema;
  if (value === void 0)
    return value;
  if (type === "BOOLEAN")
    return value[0] === 1;
  if (type === "BYTE_ARRAY")
    return parsers.stringFromBytes(value);
  const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
  if (type === "FLOAT" && view.byteLength === 4)
    return view.getFloat32(0, true);
  if (type === "DOUBLE" && view.byteLength === 8)
    return view.getFloat64(0, true);
  if (type === "INT32" && converted_type === "DATE")
    return parsers.dateFromDays(view.getInt32(0, true));
  if (type === "INT64" && converted_type === "TIMESTAMP_MILLIS")
    return parsers.timestampFromMilliseconds(view.getBigInt64(0, true));
  if (type === "INT64" && converted_type === "TIMESTAMP_MICROS")
    return parsers.timestampFromMicroseconds(view.getBigInt64(0, true));
  if (type === "INT64" && logical_type?.type === "TIMESTAMP" && logical_type?.unit === "NANOS")
    return parsers.timestampFromNanoseconds(view.getBigInt64(0, true));
  if (type === "INT64" && logical_type?.type === "TIMESTAMP" && logical_type?.unit === "MICROS")
    return parsers.timestampFromMicroseconds(view.getBigInt64(0, true));
  if (type === "INT64" && logical_type?.type === "TIMESTAMP")
    return parsers.timestampFromMilliseconds(view.getBigInt64(0, true));
  if (type === "INT32" && view.byteLength === 4)
    return view.getInt32(0, true);
  if (type === "INT64" && view.byteLength === 8)
    return view.getBigInt64(0, true);
  if (converted_type === "DECIMAL")
    return parseDecimal(value) * 10 ** -(schema.scale || 0);
  if (logical_type?.type === "FLOAT16")
    return parseFloat16(value);
  if (type === "FIXED_LEN_BYTE_ARRAY")
    return value;
  return value;
}
function concat(aaa, bbb) {
  const chunk = 1e4;
  for (let i = 0; i < bbb.length; i += chunk) {
    aaa.push(...bbb.slice(i, i + chunk));
  }
}
function equals(a, b) {
  if (a === b)
    return true;
  if (a instanceof Uint8Array && b instanceof Uint8Array)
    return equals(Array.from(a), Array.from(b));
  if (!a || !b || typeof a !== typeof b)
    return false;
  return Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((v, i) => equals(v, b[i])) : typeof a === "object" && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((k) => equals(a[k], b[k]));
}
function flatten(chunks) {
  if (!chunks)
    return [];
  if (chunks.length === 1)
    return chunks[0];
  const output = [];
  for (const chunk of chunks) {
    concat(output, chunk);
  }
  return output;
}
function canSkipRowGroup(filter, group, physicalColumns) {
  if (!filter)
    return false;
  if ("$and" in filter && Array.isArray(filter.$and)) {
    return filter.$and.some((subFilter) => canSkipRowGroup(subFilter, group, physicalColumns));
  }
  if ("$or" in filter && Array.isArray(filter.$or)) {
    return filter.$or.every((subFilter) => canSkipRowGroup(subFilter, group, physicalColumns));
  }
  if ("$nor" in filter && Array.isArray(filter.$nor)) {
    return false;
  }
  for (const [field, condition] of Object.entries(filter)) {
    const columnIndex = physicalColumns.indexOf(field);
    if (columnIndex === -1)
      continue;
    const columnChunk = group.columns[columnIndex];
    const stats = columnChunk.meta_data?.statistics;
    if (!stats)
      continue;
    const { min, max, min_value, max_value } = stats;
    const minVal = min_value !== void 0 ? min_value : min;
    const maxVal = max_value !== void 0 ? max_value : max;
    if (minVal === void 0 || maxVal === void 0)
      continue;
    for (const [operator, target] of Object.entries(condition || {})) {
      if (operator === "$gt" && maxVal <= target)
        return true;
      if (operator === "$gte" && maxVal < target)
        return true;
      if (operator === "$lt" && minVal >= target)
        return true;
      if (operator === "$lte" && minVal > target)
        return true;
      if (operator === "$eq" && (target < minVal || target > maxVal))
        return true;
      if (operator === "$ne" && equals(minVal, maxVal) && equals(minVal, target))
        return true;
      if (operator === "$in" && Array.isArray(target) && target.every((v) => v < minVal || v > maxVal))
        return true;
      if (operator === "$nin" && Array.isArray(target) && equals(minVal, maxVal) && target.includes(minVal))
        return true;
    }
  }
  return false;
}
const columnChunkAggregation = 1 << 25;
function parquetPlan({ metadata, rowStart = 0, rowEnd = Infinity, columns, filter }) {
  if (!metadata)
    throw new Error("parquetPlan requires metadata");
  const groups = [];
  const fetches = [];
  const physicalColumns = getPhysicalColumns(parquetSchema(metadata));
  let groupStart = 0;
  for (const rowGroup of metadata.row_groups) {
    const groupRows = Number(rowGroup.num_rows);
    const groupEnd = groupStart + groupRows;
    if (groupRows > 0 && groupEnd > rowStart && groupStart < rowEnd && !canSkipRowGroup(filter, rowGroup, physicalColumns)) {
      const ranges = [];
      for (const { file_path, meta_data } of rowGroup.columns) {
        if (file_path)
          throw new Error("parquet file_path not supported");
        if (!meta_data)
          throw new Error("parquet column metadata is undefined");
        if (!columns || columns.includes(meta_data.path_in_schema[0])) {
          ranges.push(getColumnRange(meta_data));
        }
      }
      const selectStart = Math.max(rowStart - groupStart, 0);
      const selectEnd = Math.min(rowEnd - groupStart, groupRows);
      groups.push({ ranges, rowGroup, groupStart, groupRows, selectStart, selectEnd });
      const groupSize = ranges[ranges.length - 1]?.endByte - ranges[0]?.startByte;
      if (!columns && groupSize < columnChunkAggregation) {
        fetches.push({
          startByte: ranges[0].startByte,
          endByte: ranges[ranges.length - 1].endByte
        });
      } else if (ranges.length) {
        concat(fetches, ranges);
      } else if (columns?.length) {
        throw new Error(`parquet columns not found: ${columns.join(", ")}`);
      }
    }
    groupStart = groupEnd;
  }
  if (!isFinite(rowEnd))
    rowEnd = groupStart;
  return { metadata, rowStart, rowEnd, columns, fetches, groups };
}
function getColumnRange({ dictionary_page_offset, data_page_offset, total_compressed_size }) {
  const columnOffset = dictionary_page_offset || data_page_offset;
  return {
    startByte: Number(columnOffset),
    endByte: Number(columnOffset + total_compressed_size)
  };
}
function prefetchAsyncBuffer(file, { fetches }) {
  const promises = fetches.map(({ startByte, endByte }) => file.slice(startByte, endByte));
  return {
    byteLength: file.byteLength,
    slice(start, end = file.byteLength) {
      const index = fetches.findIndex(({ startByte, endByte }) => startByte <= start && end <= endByte);
      if (index < 0)
        throw new Error(`no prefetch for range [${start}, ${end}]`);
      if (fetches[index].startByte !== start || fetches[index].endByte !== end) {
        const startOffset = start - fetches[index].startByte;
        const endOffset = end - fetches[index].startByte;
        if (promises[index] instanceof Promise) {
          return promises[index].then((buffer) => buffer.slice(startOffset, endOffset));
        } else {
          return promises[index].slice(startOffset, endOffset);
        }
      } else {
        return promises[index];
      }
    }
  };
}
function assembleLists(output, definitionLevels, repetitionLevels, values, schemaPath) {
  const n = definitionLevels?.length || repetitionLevels.length;
  if (!n)
    return values;
  const maxDefinitionLevel = getMaxDefinitionLevel(schemaPath);
  const repetitionPath = schemaPath.map(({ element }) => element.repetition_type);
  let valueIndex = 0;
  const containerStack = [output];
  let currentContainer = output;
  let currentDepth = 0;
  let currentDefLevel = 0;
  let currentRepLevel = 0;
  if (repetitionLevels[0]) {
    while (currentDepth < repetitionPath.length - 2 && currentRepLevel < repetitionLevels[0]) {
      currentDepth++;
      if (repetitionPath[currentDepth] !== "REQUIRED") {
        currentContainer = currentContainer.at(-1);
        containerStack.push(currentContainer);
        currentDefLevel++;
      }
      if (repetitionPath[currentDepth] === "REPEATED")
        currentRepLevel++;
    }
  }
  for (let i = 0; i < n; i++) {
    const def = definitionLevels?.length ? definitionLevels[i] : maxDefinitionLevel;
    const rep = repetitionLevels[i];
    while (currentDepth && (rep < currentRepLevel || repetitionPath[currentDepth] !== "REPEATED")) {
      if (repetitionPath[currentDepth] !== "REQUIRED") {
        containerStack.pop();
        currentDefLevel--;
      }
      if (repetitionPath[currentDepth] === "REPEATED")
        currentRepLevel--;
      currentDepth--;
    }
    currentContainer = containerStack.at(-1);
    while ((currentDepth < repetitionPath.length - 2 || repetitionPath[currentDepth + 1] === "REPEATED") && (currentDefLevel < def || repetitionPath[currentDepth + 1] === "REQUIRED")) {
      currentDepth++;
      if (repetitionPath[currentDepth] !== "REQUIRED") {
        const newList = [];
        currentContainer.push(newList);
        currentContainer = newList;
        containerStack.push(newList);
        currentDefLevel++;
      }
      if (repetitionPath[currentDepth] === "REPEATED")
        currentRepLevel++;
    }
    if (def === maxDefinitionLevel) {
      currentContainer.push(values[valueIndex++]);
    } else if (currentDepth === repetitionPath.length - 2) {
      currentContainer.push(null);
    } else {
      currentContainer.push([]);
    }
  }
  if (!output.length) {
    for (let i = 0; i < maxDefinitionLevel; i++) {
      const newList = [];
      currentContainer.push(newList);
      currentContainer = newList;
    }
  }
  return output;
}
function assembleNested(subcolumnData, schema, depth = 0) {
  const path = schema.path.join(".");
  const optional = schema.element.repetition_type === "OPTIONAL";
  const nextDepth = optional ? depth + 1 : depth;
  if (isListLike(schema)) {
    let sublist = schema.children[0];
    let subDepth = nextDepth;
    if (sublist.children.length === 1) {
      sublist = sublist.children[0];
      subDepth++;
    }
    assembleNested(subcolumnData, sublist, subDepth);
    const subcolumn = sublist.path.join(".");
    const values = subcolumnData.get(subcolumn);
    if (!values)
      throw new Error("parquet list column missing values");
    if (optional)
      flattenAtDepth(values, depth);
    subcolumnData.set(path, values);
    subcolumnData.delete(subcolumn);
    return;
  }
  if (isMapLike(schema)) {
    const mapName = schema.children[0].element.name;
    assembleNested(subcolumnData, schema.children[0].children[0], nextDepth + 1);
    assembleNested(subcolumnData, schema.children[0].children[1], nextDepth + 1);
    const keys = subcolumnData.get(`${path}.${mapName}.key`);
    const values = subcolumnData.get(`${path}.${mapName}.value`);
    if (!keys)
      throw new Error("parquet map column missing keys");
    if (!values)
      throw new Error("parquet map column missing values");
    if (keys.length !== values.length) {
      throw new Error("parquet map column key/value length mismatch");
    }
    const out = assembleMaps(keys, values, nextDepth);
    if (optional)
      flattenAtDepth(out, depth);
    subcolumnData.delete(`${path}.${mapName}.key`);
    subcolumnData.delete(`${path}.${mapName}.value`);
    subcolumnData.set(path, out);
    return;
  }
  if (schema.children.length) {
    const invertDepth = schema.element.repetition_type === "REQUIRED" ? depth : depth + 1;
    const struct = {};
    for (const child of schema.children) {
      assembleNested(subcolumnData, child, invertDepth);
      const childData = subcolumnData.get(child.path.join("."));
      if (!childData)
        throw new Error("parquet struct missing child data");
      struct[child.element.name] = childData;
    }
    for (const child of schema.children) {
      subcolumnData.delete(child.path.join("."));
    }
    const inverted = invertStruct(struct, invertDepth);
    if (optional)
      flattenAtDepth(inverted, depth);
    subcolumnData.set(path, inverted);
  }
}
function flattenAtDepth(arr, depth) {
  for (let i = 0; i < arr.length; i++) {
    if (depth) {
      flattenAtDepth(arr[i], depth - 1);
    } else {
      arr[i] = arr[i][0];
    }
  }
}
function assembleMaps(keys, values, depth) {
  const out = [];
  for (let i = 0; i < keys.length; i++) {
    if (depth) {
      out.push(assembleMaps(keys[i], values[i], depth - 1));
    } else {
      if (keys[i]) {
        const obj = {};
        for (let j = 0; j < keys[i].length; j++) {
          const value = values[i][j];
          obj[keys[i][j]] = value === void 0 ? null : value;
        }
        out.push(obj);
      } else {
        out.push(void 0);
      }
    }
  }
  return out;
}
function invertStruct(struct, depth) {
  const keys = Object.keys(struct);
  const length = struct[keys[0]]?.length;
  const out = [];
  for (let i = 0; i < length; i++) {
    const obj = {};
    for (const key of keys) {
      if (struct[key].length !== length)
        throw new Error("parquet struct parsing error");
      obj[key] = struct[key][i];
    }
    if (depth) {
      out.push(invertStruct(obj, depth - 1));
    } else {
      out.push(obj);
    }
  }
  return out;
}
function deltaBinaryUnpack(reader, count, output) {
  const int32 = output instanceof Int32Array;
  const blockSize = readVarInt(reader);
  const miniblockPerBlock = readVarInt(reader);
  readVarInt(reader);
  let value = readZigZagBigInt(reader);
  let outputIndex = 0;
  output[outputIndex++] = int32 ? Number(value) : value;
  const valuesPerMiniblock = blockSize / miniblockPerBlock;
  while (outputIndex < count) {
    const minDelta = readZigZagBigInt(reader);
    const bitWidths = new Uint8Array(miniblockPerBlock);
    for (let i = 0; i < miniblockPerBlock; i++) {
      bitWidths[i] = reader.view.getUint8(reader.offset++);
    }
    for (let i = 0; i < miniblockPerBlock && outputIndex < count; i++) {
      const bitWidth2 = BigInt(bitWidths[i]);
      if (bitWidth2) {
        let bitpackPos = 0n;
        let miniblockCount = valuesPerMiniblock;
        const mask = (1n << bitWidth2) - 1n;
        while (miniblockCount && outputIndex < count) {
          let bits = BigInt(reader.view.getUint8(reader.offset)) >> bitpackPos & mask;
          bitpackPos += bitWidth2;
          while (bitpackPos >= 8) {
            bitpackPos -= 8n;
            reader.offset++;
            if (bitpackPos) {
              bits |= BigInt(reader.view.getUint8(reader.offset)) << bitWidth2 - bitpackPos & mask;
            }
          }
          const delta = minDelta + bits;
          value += delta;
          output[outputIndex++] = int32 ? Number(value) : value;
          miniblockCount--;
        }
        if (miniblockCount) {
          reader.offset += Math.ceil((miniblockCount * Number(bitWidth2) + Number(bitpackPos)) / 8);
        }
      } else {
        for (let j = 0; j < valuesPerMiniblock && outputIndex < count; j++) {
          value += minDelta;
          output[outputIndex++] = int32 ? Number(value) : value;
        }
      }
    }
  }
}
function deltaLengthByteArray(reader, count, output) {
  const lengths = new Int32Array(count);
  deltaBinaryUnpack(reader, count, lengths);
  for (let i = 0; i < count; i++) {
    output[i] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, lengths[i]);
    reader.offset += lengths[i];
  }
}
function deltaByteArray(reader, count, output) {
  const prefixData = new Int32Array(count);
  deltaBinaryUnpack(reader, count, prefixData);
  const suffixData = new Int32Array(count);
  deltaBinaryUnpack(reader, count, suffixData);
  for (let i = 0; i < count; i++) {
    const suffix = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, suffixData[i]);
    if (prefixData[i]) {
      output[i] = new Uint8Array(prefixData[i] + suffixData[i]);
      output[i].set(output[i - 1].subarray(0, prefixData[i]));
      output[i].set(suffix, prefixData[i]);
    } else {
      output[i] = suffix;
    }
    reader.offset += suffixData[i];
  }
}
function bitWidth(value) {
  return 32 - Math.clz32(value);
}
function readRleBitPackedHybrid(reader, width, output, length) {
  if (length === void 0) {
    length = reader.view.getUint32(reader.offset, true);
    reader.offset += 4;
  }
  const startOffset = reader.offset;
  let seen = 0;
  while (seen < output.length) {
    const header = readVarInt(reader);
    if (header & 1) {
      seen = readBitPacked(reader, header, width, output, seen);
    } else {
      const count = header >>> 1;
      readRle(reader, count, width, output, seen);
      seen += count;
    }
  }
  reader.offset = startOffset + length;
}
function readRle(reader, count, bitWidth2, output, seen) {
  const width = bitWidth2 + 7 >> 3;
  let value = 0;
  for (let i = 0; i < width; i++) {
    value |= reader.view.getUint8(reader.offset++) << (i << 3);
  }
  for (let i = 0; i < count; i++) {
    output[seen + i] = value;
  }
}
function readBitPacked(reader, header, bitWidth2, output, seen) {
  let count = header >> 1 << 3;
  const mask = (1 << bitWidth2) - 1;
  let data = 0;
  if (reader.offset < reader.view.byteLength) {
    data = reader.view.getUint8(reader.offset++);
  } else if (mask) {
    throw new Error(`parquet bitpack offset ${reader.offset} out of range`);
  }
  let left = 8;
  let right = 0;
  while (count) {
    if (right > 8) {
      right -= 8;
      left -= 8;
      data >>>= 8;
    } else if (left - right < bitWidth2) {
      data |= reader.view.getUint8(reader.offset) << left;
      reader.offset++;
      left += 8;
    } else {
      if (seen < output.length) {
        output[seen++] = data >> right & mask;
      }
      count--;
      right += bitWidth2;
    }
  }
  return seen;
}
function byteStreamSplit(reader, count, type, typeLength) {
  const width = byteWidth(type, typeLength);
  const bytes = new Uint8Array(count * width);
  for (let b = 0; b < width; b++) {
    for (let i = 0; i < count; i++) {
      bytes[i * width + b] = reader.view.getUint8(reader.offset++);
    }
  }
  if (type === "FLOAT")
    return new Float32Array(bytes.buffer);
  else if (type === "DOUBLE")
    return new Float64Array(bytes.buffer);
  else if (type === "INT32")
    return new Int32Array(bytes.buffer);
  else if (type === "INT64")
    return new BigInt64Array(bytes.buffer);
  else if (type === "FIXED_LEN_BYTE_ARRAY") {
    const split = new Array(count);
    for (let i = 0; i < count; i++) {
      split[i] = bytes.subarray(i * width, (i + 1) * width);
    }
    return split;
  }
  throw new Error(`parquet byte_stream_split unsupported type: ${type}`);
}
function byteWidth(type, typeLength) {
  switch (type) {
    case "INT32":
    case "FLOAT":
      return 4;
    case "INT64":
    case "DOUBLE":
      return 8;
    case "FIXED_LEN_BYTE_ARRAY":
      if (!typeLength)
        throw new Error("parquet byteWidth missing type_length");
      return typeLength;
    default:
      throw new Error(`parquet unsupported type: ${type}`);
  }
}
function readPlain(reader, type, count, fixedLength) {
  if (count === 0)
    return [];
  if (type === "BOOLEAN") {
    return readPlainBoolean(reader, count);
  } else if (type === "INT32") {
    return readPlainInt32(reader, count);
  } else if (type === "INT64") {
    return readPlainInt64(reader, count);
  } else if (type === "INT96") {
    return readPlainInt96(reader, count);
  } else if (type === "FLOAT") {
    return readPlainFloat(reader, count);
  } else if (type === "DOUBLE") {
    return readPlainDouble(reader, count);
  } else if (type === "BYTE_ARRAY") {
    return readPlainByteArray(reader, count);
  } else if (type === "FIXED_LEN_BYTE_ARRAY") {
    if (!fixedLength)
      throw new Error("parquet missing fixed length");
    return readPlainByteArrayFixed(reader, count, fixedLength);
  } else {
    throw new Error(`parquet unhandled type: ${type}`);
  }
}
function readPlainBoolean(reader, count) {
  const values = new Array(count);
  for (let i = 0; i < count; i++) {
    const byteOffset = reader.offset + (i / 8 | 0);
    const bitOffset = i % 8;
    const byte = reader.view.getUint8(byteOffset);
    values[i] = (byte & 1 << bitOffset) !== 0;
  }
  reader.offset += Math.ceil(count / 8);
  return values;
}
function readPlainInt32(reader, count) {
  const values = (reader.view.byteOffset + reader.offset) % 4 ? new Int32Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 4)) : new Int32Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
  reader.offset += count * 4;
  return values;
}
function readPlainInt64(reader, count) {
  const values = (reader.view.byteOffset + reader.offset) % 8 ? new BigInt64Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 8)) : new BigInt64Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
  reader.offset += count * 8;
  return values;
}
function readPlainInt96(reader, count) {
  const values = new Array(count);
  for (let i = 0; i < count; i++) {
    const low = reader.view.getBigInt64(reader.offset + i * 12, true);
    const high = reader.view.getInt32(reader.offset + i * 12 + 8, true);
    values[i] = BigInt(high) << 64n | low;
  }
  reader.offset += count * 12;
  return values;
}
function readPlainFloat(reader, count) {
  const values = (reader.view.byteOffset + reader.offset) % 4 ? new Float32Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 4)) : new Float32Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
  reader.offset += count * 4;
  return values;
}
function readPlainDouble(reader, count) {
  const values = (reader.view.byteOffset + reader.offset) % 8 ? new Float64Array(align(reader.view.buffer, reader.view.byteOffset + reader.offset, count * 8)) : new Float64Array(reader.view.buffer, reader.view.byteOffset + reader.offset, count);
  reader.offset += count * 8;
  return values;
}
function readPlainByteArray(reader, count) {
  const values = new Array(count);
  for (let i = 0; i < count; i++) {
    const length = reader.view.getUint32(reader.offset, true);
    reader.offset += 4;
    values[i] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, length);
    reader.offset += length;
  }
  return values;
}
function readPlainByteArrayFixed(reader, count, fixedLength) {
  const values = new Array(count);
  for (let i = 0; i < count; i++) {
    values[i] = new Uint8Array(reader.view.buffer, reader.view.byteOffset + reader.offset, fixedLength);
    reader.offset += fixedLength;
  }
  return values;
}
function align(buffer, offset, size) {
  const aligned = new ArrayBuffer(size);
  new Uint8Array(aligned).set(new Uint8Array(buffer, offset, size));
  return aligned;
}
const WORD_MASK = [0, 255, 65535, 16777215, 4294967295];
function copyBytes(fromArray, fromPos, toArray, toPos, length) {
  for (let i = 0; i < length; i++) {
    toArray[toPos + i] = fromArray[fromPos + i];
  }
}
function snappyUncompress(input, output) {
  const inputLength = input.byteLength;
  const outputLength = output.byteLength;
  let pos = 0;
  let outPos = 0;
  while (pos < inputLength) {
    const c = input[pos];
    pos++;
    if (c < 128) {
      break;
    }
  }
  if (outputLength && pos >= inputLength) {
    throw new Error("invalid snappy length header");
  }
  while (pos < inputLength) {
    const c = input[pos];
    let len = 0;
    pos++;
    if (pos >= inputLength) {
      throw new Error("missing eof marker");
    }
    if ((c & 3) === 0) {
      let len2 = (c >>> 2) + 1;
      if (len2 > 60) {
        if (pos + 3 >= inputLength) {
          throw new Error("snappy error literal pos + 3 >= inputLength");
        }
        const lengthSize = len2 - 60;
        len2 = input[pos] + (input[pos + 1] << 8) + (input[pos + 2] << 16) + (input[pos + 3] << 24);
        len2 = (len2 & WORD_MASK[lengthSize]) + 1;
        pos += lengthSize;
      }
      if (pos + len2 > inputLength) {
        throw new Error("snappy error literal exceeds input length");
      }
      copyBytes(input, pos, output, outPos, len2);
      pos += len2;
      outPos += len2;
    } else {
      let offset = 0;
      switch (c & 3) {
        case 1:
          len = (c >>> 2 & 7) + 4;
          offset = input[pos] + (c >>> 5 << 8);
          pos++;
          break;
        case 2:
          if (inputLength <= pos + 1) {
            throw new Error("snappy error end of input");
          }
          len = (c >>> 2) + 1;
          offset = input[pos] + (input[pos + 1] << 8);
          pos += 2;
          break;
        case 3:
          if (inputLength <= pos + 3) {
            throw new Error("snappy error end of input");
          }
          len = (c >>> 2) + 1;
          offset = input[pos] + (input[pos + 1] << 8) + (input[pos + 2] << 16) + (input[pos + 3] << 24);
          pos += 4;
          break;
      }
      if (offset === 0 || isNaN(offset)) {
        throw new Error(`invalid offset ${offset} pos ${pos} inputLength ${inputLength}`);
      }
      if (offset > outPos) {
        throw new Error("cannot copy from before start of buffer");
      }
      copyBytes(output, outPos - offset, output, outPos, len);
      outPos += len;
    }
  }
  if (outPos !== outputLength)
    throw new Error("premature end of input");
}
function readDataPage(bytes, daph, { type, element, schemaPath }) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reader = { view, offset: 0 };
  let dataPage;
  const repetitionLevels = readRepetitionLevels(reader, daph, schemaPath);
  const { definitionLevels, numNulls } = readDefinitionLevels(reader, daph, schemaPath);
  const nValues = daph.num_values - numNulls;
  if (daph.encoding === "PLAIN") {
    dataPage = readPlain(reader, type, nValues, element.type_length);
  } else if (daph.encoding === "PLAIN_DICTIONARY" || daph.encoding === "RLE_DICTIONARY" || daph.encoding === "RLE") {
    const bitWidth2 = type === "BOOLEAN" ? 1 : view.getUint8(reader.offset++);
    if (bitWidth2) {
      dataPage = new Array(nValues);
      if (type === "BOOLEAN") {
        readRleBitPackedHybrid(reader, bitWidth2, dataPage);
        dataPage = dataPage.map((x) => !!x);
      } else {
        readRleBitPackedHybrid(reader, bitWidth2, dataPage, view.byteLength - reader.offset);
      }
    } else {
      dataPage = new Uint8Array(nValues);
    }
  } else if (daph.encoding === "BYTE_STREAM_SPLIT") {
    dataPage = byteStreamSplit(reader, nValues, type, element.type_length);
  } else if (daph.encoding === "DELTA_BINARY_PACKED") {
    const int32 = type === "INT32";
    dataPage = int32 ? new Int32Array(nValues) : new BigInt64Array(nValues);
    deltaBinaryUnpack(reader, nValues, dataPage);
  } else if (daph.encoding === "DELTA_LENGTH_BYTE_ARRAY") {
    dataPage = new Array(nValues);
    deltaLengthByteArray(reader, nValues, dataPage);
  } else {
    throw new Error(`parquet unsupported encoding: ${daph.encoding}`);
  }
  return { definitionLevels, repetitionLevels, dataPage };
}
function readRepetitionLevels(reader, daph, schemaPath) {
  if (schemaPath.length > 1) {
    const maxRepetitionLevel = getMaxRepetitionLevel(schemaPath);
    if (maxRepetitionLevel) {
      const values = new Array(daph.num_values);
      readRleBitPackedHybrid(reader, bitWidth(maxRepetitionLevel), values);
      return values;
    }
  }
  return [];
}
function readDefinitionLevels(reader, daph, schemaPath) {
  const maxDefinitionLevel = getMaxDefinitionLevel(schemaPath);
  if (!maxDefinitionLevel)
    return { definitionLevels: [], numNulls: 0 };
  const definitionLevels = new Array(daph.num_values);
  readRleBitPackedHybrid(reader, bitWidth(maxDefinitionLevel), definitionLevels);
  let numNulls = daph.num_values;
  for (const def of definitionLevels) {
    if (def === maxDefinitionLevel)
      numNulls--;
  }
  if (numNulls === 0)
    definitionLevels.length = 0;
  return { definitionLevels, numNulls };
}
function decompressPage(compressedBytes, uncompressed_page_size, codec, compressors2) {
  let page;
  const customDecompressor = compressors2?.[codec];
  if (codec === "UNCOMPRESSED") {
    page = compressedBytes;
  } else if (customDecompressor) {
    page = customDecompressor(compressedBytes, uncompressed_page_size);
  } else if (codec === "SNAPPY") {
    page = new Uint8Array(uncompressed_page_size);
    snappyUncompress(compressedBytes, page);
  } else {
    throw new Error(`parquet unsupported compression codec: ${codec}`);
  }
  if (page?.length !== uncompressed_page_size) {
    throw new Error(`parquet decompressed page length ${page?.length} does not match header ${uncompressed_page_size}`);
  }
  return page;
}
function readDataPageV2(compressedBytes, ph, columnDecoder) {
  const view = new DataView(compressedBytes.buffer, compressedBytes.byteOffset, compressedBytes.byteLength);
  const reader = { view, offset: 0 };
  const { type, element, schemaPath, codec, compressors: compressors2 } = columnDecoder;
  const daph2 = ph.data_page_header_v2;
  if (!daph2)
    throw new Error("parquet data page header v2 is undefined");
  const repetitionLevels = readRepetitionLevelsV2(reader, daph2, schemaPath);
  reader.offset = daph2.repetition_levels_byte_length;
  const definitionLevels = readDefinitionLevelsV2(reader, daph2, schemaPath);
  const uncompressedPageSize = ph.uncompressed_page_size - daph2.definition_levels_byte_length - daph2.repetition_levels_byte_length;
  let page = compressedBytes.subarray(reader.offset);
  if (daph2.is_compressed !== false) {
    page = decompressPage(page, uncompressedPageSize, codec, compressors2);
  }
  const pageView = new DataView(page.buffer, page.byteOffset, page.byteLength);
  const pageReader = { view: pageView, offset: 0 };
  let dataPage;
  const nValues = daph2.num_values - daph2.num_nulls;
  if (daph2.encoding === "PLAIN") {
    dataPage = readPlain(pageReader, type, nValues, element.type_length);
  } else if (daph2.encoding === "RLE") {
    dataPage = new Array(nValues);
    readRleBitPackedHybrid(pageReader, 1, dataPage);
    dataPage = dataPage.map((x) => !!x);
  } else if (daph2.encoding === "PLAIN_DICTIONARY" || daph2.encoding === "RLE_DICTIONARY") {
    const bitWidth2 = pageView.getUint8(pageReader.offset++);
    dataPage = new Array(nValues);
    readRleBitPackedHybrid(pageReader, bitWidth2, dataPage, uncompressedPageSize - 1);
  } else if (daph2.encoding === "DELTA_BINARY_PACKED") {
    const int32 = type === "INT32";
    dataPage = int32 ? new Int32Array(nValues) : new BigInt64Array(nValues);
    deltaBinaryUnpack(pageReader, nValues, dataPage);
  } else if (daph2.encoding === "DELTA_LENGTH_BYTE_ARRAY") {
    dataPage = new Array(nValues);
    deltaLengthByteArray(pageReader, nValues, dataPage);
  } else if (daph2.encoding === "DELTA_BYTE_ARRAY") {
    dataPage = new Array(nValues);
    deltaByteArray(pageReader, nValues, dataPage);
  } else if (daph2.encoding === "BYTE_STREAM_SPLIT") {
    dataPage = byteStreamSplit(pageReader, nValues, type, element.type_length);
  } else {
    throw new Error(`parquet unsupported encoding: ${daph2.encoding}`);
  }
  return { definitionLevels, repetitionLevels, dataPage };
}
function readRepetitionLevelsV2(reader, daph2, schemaPath) {
  const maxRepetitionLevel = getMaxRepetitionLevel(schemaPath);
  if (!maxRepetitionLevel)
    return [];
  const values = new Array(daph2.num_values);
  readRleBitPackedHybrid(reader, bitWidth(maxRepetitionLevel), values, daph2.repetition_levels_byte_length);
  return values;
}
function readDefinitionLevelsV2(reader, daph2, schemaPath) {
  const maxDefinitionLevel = getMaxDefinitionLevel(schemaPath);
  if (maxDefinitionLevel) {
    const values = new Array(daph2.num_values);
    readRleBitPackedHybrid(reader, bitWidth(maxDefinitionLevel), values, daph2.definition_levels_byte_length);
    return values;
  }
}
function readColumn(reader, { groupStart, selectStart, selectEnd }, columnDecoder, onPage) {
  const { pathInSchema, schemaPath } = columnDecoder;
  const isFlat = isFlatColumn(schemaPath);
  const chunks = [];
  let dictionary = void 0;
  let lastChunk = void 0;
  let rowCount = 0;
  const emitLastChunk = onPage && (() => {
    lastChunk && onPage({
      pathInSchema,
      columnData: lastChunk,
      rowStart: groupStart + rowCount - lastChunk.length,
      rowEnd: groupStart + rowCount
    });
  });
  while (isFlat ? rowCount < selectEnd : reader.offset < reader.view.byteLength - 1) {
    if (reader.offset >= reader.view.byteLength - 1)
      break;
    const header = parquetHeader(reader);
    if (header.type === "DICTIONARY_PAGE") {
      dictionary = readPage(reader, header, columnDecoder, dictionary, void 0, 0);
      dictionary = convert(dictionary, columnDecoder);
    } else {
      const lastChunkLength = lastChunk?.length || 0;
      const values = readPage(reader, header, columnDecoder, dictionary, lastChunk, selectStart - rowCount);
      if (lastChunk === values) {
        rowCount += values.length - lastChunkLength;
      } else {
        emitLastChunk?.();
        chunks.push(values);
        rowCount += values.length;
        lastChunk = values;
      }
    }
  }
  emitLastChunk?.();
  if (rowCount > selectEnd && lastChunk) {
    chunks[chunks.length - 1] = lastChunk.slice(0, selectEnd - (rowCount - lastChunk.length));
  }
  return chunks;
}
function readPage(reader, header, columnDecoder, dictionary, previousChunk, pageStart) {
  const { type, element, schemaPath, codec, compressors: compressors2 } = columnDecoder;
  const compressedBytes = new Uint8Array(
    reader.view.buffer,
    reader.view.byteOffset + reader.offset,
    header.compressed_page_size
  );
  reader.offset += header.compressed_page_size;
  if (header.type === "DATA_PAGE") {
    const daph = header.data_page_header;
    if (!daph)
      throw new Error("parquet data page header is undefined");
    if (pageStart > daph.num_values && isFlatColumn(schemaPath)) {
      return new Array(daph.num_values);
    }
    const page = decompressPage(compressedBytes, Number(header.uncompressed_page_size), codec, compressors2);
    const { definitionLevels, repetitionLevels, dataPage } = readDataPage(page, daph, columnDecoder);
    let values = convertWithDictionary(dataPage, dictionary, daph.encoding, columnDecoder);
    if (repetitionLevels.length || definitionLevels?.length) {
      const output = Array.isArray(previousChunk) ? previousChunk : [];
      return assembleLists(output, definitionLevels, repetitionLevels, values, schemaPath);
    } else {
      for (let i = 2; i < schemaPath.length; i++) {
        if (schemaPath[i].element.repetition_type !== "REQUIRED") {
          values = Array.from(values, (e) => [e]);
        }
      }
      return values;
    }
  } else if (header.type === "DATA_PAGE_V2") {
    const daph2 = header.data_page_header_v2;
    if (!daph2)
      throw new Error("parquet data page header v2 is undefined");
    if (pageStart > daph2.num_rows) {
      return new Array(daph2.num_values);
    }
    const { definitionLevels, repetitionLevels, dataPage } = readDataPageV2(compressedBytes, header, columnDecoder);
    const values = convertWithDictionary(dataPage, dictionary, daph2.encoding, columnDecoder);
    const output = Array.isArray(previousChunk) ? previousChunk : [];
    return assembleLists(output, definitionLevels, repetitionLevels, values, schemaPath);
  } else if (header.type === "DICTIONARY_PAGE") {
    const diph = header.dictionary_page_header;
    if (!diph)
      throw new Error("parquet dictionary page header is undefined");
    const page = decompressPage(
      compressedBytes,
      Number(header.uncompressed_page_size),
      codec,
      compressors2
    );
    const reader2 = { view: new DataView(page.buffer, page.byteOffset, page.byteLength), offset: 0 };
    return readPlain(reader2, type, diph.num_values, element.type_length);
  } else {
    throw new Error(`parquet unsupported page type: ${header.type}`);
  }
}
function parquetHeader(reader) {
  const header = deserializeTCompactProtocol(reader);
  const type = PageTypes[header.field_1];
  const uncompressed_page_size = header.field_2;
  const compressed_page_size = header.field_3;
  const crc = header.field_4;
  const data_page_header = header.field_5 && {
    num_values: header.field_5.field_1,
    encoding: Encodings[header.field_5.field_2],
    definition_level_encoding: Encodings[header.field_5.field_3],
    repetition_level_encoding: Encodings[header.field_5.field_4],
    statistics: header.field_5.field_5 && {
      max: header.field_5.field_5.field_1,
      min: header.field_5.field_5.field_2,
      null_count: header.field_5.field_5.field_3,
      distinct_count: header.field_5.field_5.field_4,
      max_value: header.field_5.field_5.field_5,
      min_value: header.field_5.field_5.field_6
    }
  };
  const index_page_header = header.field_6;
  const dictionary_page_header = header.field_7 && {
    num_values: header.field_7.field_1,
    encoding: Encodings[header.field_7.field_2],
    is_sorted: header.field_7.field_3
  };
  const data_page_header_v2 = header.field_8 && {
    num_values: header.field_8.field_1,
    num_nulls: header.field_8.field_2,
    num_rows: header.field_8.field_3,
    encoding: Encodings[header.field_8.field_4],
    definition_levels_byte_length: header.field_8.field_5,
    repetition_levels_byte_length: header.field_8.field_6,
    is_compressed: header.field_8.field_7 === void 0 ? true : header.field_8.field_7,
    statistics: header.field_8.field_8
  };
  return {
    type,
    uncompressed_page_size,
    compressed_page_size,
    crc,
    data_page_header,
    index_page_header,
    dictionary_page_header,
    data_page_header_v2
  };
}
function readRowGroup(options, { metadata, columns }, groupPlan) {
  const { file, compressors: compressors2, utf8 } = options;
  const asyncColumns = [];
  const parsers = { ...DEFAULT_PARSERS, ...options.parsers };
  for (const { file_path, meta_data } of groupPlan.rowGroup.columns) {
    if (file_path)
      throw new Error("parquet file_path not supported");
    if (!meta_data)
      throw new Error("parquet column metadata is undefined");
    const columnName = meta_data.path_in_schema[0];
    if (columns && !columns.includes(columnName))
      continue;
    const { startByte, endByte } = getColumnRange(meta_data);
    const columnBytes = endByte - startByte;
    if (columnBytes > 1 << 30) {
      console.warn(`parquet skipping huge column "${meta_data.path_in_schema}" ${columnBytes} bytes`);
      continue;
    }
    const buffer = Promise.resolve(file.slice(startByte, endByte));
    asyncColumns.push({
      pathInSchema: meta_data.path_in_schema,
      data: buffer.then((arrayBuffer) => {
        const schemaPath = getSchemaPath(metadata.schema, meta_data.path_in_schema);
        const reader = { view: new DataView(arrayBuffer), offset: 0 };
        const columnDecoder = {
          pathInSchema: meta_data.path_in_schema,
          type: meta_data.type,
          element: schemaPath[schemaPath.length - 1].element,
          schemaPath,
          codec: meta_data.codec,
          parsers,
          compressors: compressors2,
          utf8
        };
        return readColumn(reader, groupPlan, columnDecoder, options.onPage);
      })
    });
  }
  return { groupStart: groupPlan.groupStart, groupRows: groupPlan.groupRows, asyncColumns };
}
async function asyncGroupToRows({ asyncColumns }, selectStart, selectEnd, columns, rowFormat) {
  const columnDatas = await Promise.all(asyncColumns.map(({ data }) => data.then(flatten)));
  const includedColumnNames = asyncColumns.map((child) => child.pathInSchema[0]).filter((name) => !columns || columns.includes(name));
  const columnOrder = columns ?? includedColumnNames;
  const columnIndexes = columnOrder.map((name) => asyncColumns.findIndex((column) => column.pathInSchema[0] === name));
  const selectCount = selectEnd - selectStart;
  if (rowFormat === "object") {
    const groupData2 = new Array(selectCount);
    for (let selectRow = 0; selectRow < selectCount; selectRow++) {
      const row = selectStart + selectRow;
      const rowData = {};
      for (let i = 0; i < asyncColumns.length; i++) {
        rowData[asyncColumns[i].pathInSchema[0]] = columnDatas[i][row];
      }
      groupData2[selectRow] = rowData;
    }
    return groupData2;
  }
  const groupData = new Array(selectCount);
  for (let selectRow = 0; selectRow < selectCount; selectRow++) {
    const row = selectStart + selectRow;
    const rowData = new Array(asyncColumns.length);
    for (let i = 0; i < columnOrder.length; i++) {
      if (columnIndexes[i] >= 0) {
        rowData[i] = columnDatas[columnIndexes[i]][row];
      }
    }
    groupData[selectRow] = rowData;
  }
  return groupData;
}
function assembleAsync(asyncRowGroup, schemaTree2) {
  const { asyncColumns } = asyncRowGroup;
  const assembled = [];
  for (const child of schemaTree2.children) {
    if (child.children.length) {
      const childColumns = asyncColumns.filter((column) => column.pathInSchema[0] === child.element.name);
      if (!childColumns.length)
        continue;
      const flatData = /* @__PURE__ */ new Map();
      const data = Promise.all(childColumns.map((column) => {
        return column.data.then((columnData) => {
          flatData.set(column.pathInSchema.join("."), flatten(columnData));
        });
      })).then(() => {
        assembleNested(flatData, child);
        const flatColumn = flatData.get(child.path.join("."));
        if (!flatColumn)
          throw new Error("parquet column data not assembled");
        return [flatColumn];
      });
      assembled.push({ pathInSchema: child.path, data });
    } else {
      const asyncColumn = asyncColumns.find((column) => column.pathInSchema[0] === child.element.name);
      if (asyncColumn) {
        assembled.push(asyncColumn);
      }
    }
  }
  return { ...asyncRowGroup, asyncColumns: assembled };
}
async function parquetRead(options) {
  options.metadata ??= await parquetMetadataAsync(options.file, options);
  const asyncGroups = parquetReadAsync(options);
  const { rowStart = 0, rowEnd, columns, onChunk, onComplete, rowFormat } = options;
  if (!onComplete && !onChunk) {
    for (const { asyncColumns } of asyncGroups) {
      for (const { data } of asyncColumns)
        await data;
    }
    return;
  }
  const schemaTree2 = parquetSchema(options.metadata);
  const assembled = asyncGroups.map((arg) => assembleAsync(arg, schemaTree2));
  if (onChunk) {
    for (const asyncGroup of assembled) {
      for (const asyncColumn of asyncGroup.asyncColumns) {
        asyncColumn.data.then((columnDatas) => {
          let rowStart2 = asyncGroup.groupStart;
          for (const columnData of columnDatas) {
            onChunk({
              columnName: asyncColumn.pathInSchema[0],
              columnData,
              rowStart: rowStart2,
              rowEnd: rowStart2 + columnData.length
            });
            rowStart2 += columnData.length;
          }
        });
      }
    }
  }
  if (onComplete) {
    const rows = [];
    for (const asyncGroup of assembled) {
      const selectStart = Math.max(rowStart - asyncGroup.groupStart, 0);
      const selectEnd = Math.min((rowEnd ?? Infinity) - asyncGroup.groupStart, asyncGroup.groupRows);
      const groupData = rowFormat === "object" ? await asyncGroupToRows(asyncGroup, selectStart, selectEnd, columns, "object") : await asyncGroupToRows(asyncGroup, selectStart, selectEnd, columns, "array");
      concat(rows, groupData);
    }
    onComplete(rows);
  } else {
    for (const { asyncColumns } of assembled) {
      for (const { data } of asyncColumns)
        await data;
    }
  }
}
function parquetReadAsync(options) {
  if (!options.metadata)
    throw new Error("parquet requires metadata");
  const plan = parquetPlan(options);
  options.file = prefetchAsyncBuffer(options.file, plan);
  return plan.groups.map((groupPlan) => readRowGroup(options, plan, groupPlan));
}
class BuildInstancesWorkerClient {
  constructor() {
    __publicField(this, "worker");
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "nextRequestId", 1);
    this.worker = new WorkerWrapper();
    this.worker.onmessage = (event) => {
      const message = event.data;
      const pending = this.pending.get(message.id);
      if (!pending)
        return;
      this.pending.delete(message.id);
      if (message.type === "done") {
        pending.resolve(message.payload);
        return;
      }
      pending.reject(new Error(message.message));
    };
    this.worker.onerror = (event) => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error(event.message || "buildInstances worker crashed"));
      }
      this.pending.clear();
    };
  }
  build(geometry) {
    const id = this.nextRequestId++;
    const message = {
      id,
      type: "build",
      geometry
    };
    const transfers = [
      geometry.InstanceEntityIndex.buffer,
      geometry.InstanceMaterialIndex.buffer,
      geometry.InstanceMeshIndex.buffer,
      geometry.InstanceTransformIndex.buffer,
      geometry.InstanceFlags.buffer,
      geometry.VertexX.buffer,
      geometry.VertexY.buffer,
      geometry.VertexZ.buffer,
      geometry.IndexBuffer.buffer,
      geometry.MeshVertexOffset.buffer,
      geometry.MeshIndexOffset.buffer,
      geometry.MaterialRed.buffer,
      geometry.MaterialGreen.buffer,
      geometry.MaterialBlue.buffer,
      geometry.MaterialAlpha.buffer,
      geometry.MaterialRoughness.buffer,
      geometry.MaterialMetallic.buffer,
      geometry.TransformTX.buffer,
      geometry.TransformTY.buffer,
      geometry.TransformTZ.buffer,
      geometry.TransformQX.buffer,
      geometry.TransformQY.buffer,
      geometry.TransformQZ.buffer,
      geometry.TransformQW.buffer,
      geometry.TransformSX.buffer,
      geometry.TransformSY.buffer,
      geometry.TransformSZ.buffer
    ];
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(message, transfers);
    });
  }
  dispose() {
    for (const pending of this.pending.values()) {
      pending.reject(new Error("buildInstances worker disposed"));
    }
    this.pending.clear();
    this.worker.terminate();
  }
}
let buildInstancesWorkerClient = null;
function getBuildInstancesWorkerClient() {
  if (!buildInstancesWorkerClient) {
    buildInstancesWorkerClient = new BuildInstancesWorkerClient();
  }
  return buildInstancesWorkerClient;
}
function buildInstances(bg) {
  console.time("Building instances");
  const transforms = computeTransforms(bg);
  const geometries = computeMeshGeometries(bg);
  const materials = computeMaterials(bg);
  const instanceCount = bg.InstanceMeshIndex.length;
  const instances = new Array(instanceCount);
  const identity = new Matrix4();
  for (let i = 0; i < instanceCount; i++) {
    const meshIndex = bg.InstanceMeshIndex[i];
    if (meshIndex < 0)
      continue;
    const flag = bg.InstanceFlags[i];
    if (flag & 1)
      continue;
    const geometry = geometries[meshIndex];
    if (!geometry)
      continue;
    const material = materials[bg.InstanceMaterialIndex[i]];
    const transform = transforms[bg.InstanceTransformIndex[i]];
    const entity = bg.InstanceEntityIndex[i];
    const isIdentity = transform.equals(identity);
    instances[i] = {
      instance: i,
      geometry,
      material,
      materialId: bg.InstanceMaterialIndex[i],
      transform,
      entity,
      isIdentity
    };
  }
  console.timeEnd("Building instances");
  return instances;
}
async function buildInstancesAsyncConsumeGeometry(bg, mode = "sync") {
  if (typeof Worker === "undefined")
    return buildInstances(bg);
  if (mode !== "worker")
    return buildInstances(bg);
  const payload = await getBuildInstancesWorkerClient().build(bg);
  return buildInstancesFromPrecomputed(
    payload.geometry,
    payload.meshPositions,
    payload.meshNormals,
    payload.transformMatrices,
    payload.transformIdentity
  );
}
function computeMeshGeometries(bim) {
  const meshCount = bim.MeshVertexOffset.length;
  const indexCount = bim.IndexBuffer.length;
  const vertexCount = bim.VertexX.length;
  const meshGeometries = new Array(meshCount);
  const {
    VertexX,
    VertexY,
    VertexZ,
    IndexBuffer,
    MeshVertexOffset,
    MeshIndexOffset
  } = bim;
  for (let mi = 0; mi < meshCount; mi++) {
    const iStart = MeshIndexOffset[mi];
    const iEnd = mi + 1 < meshCount ? MeshIndexOffset[mi + 1] : indexCount;
    const iCount = iEnd - iStart;
    const vStart = MeshVertexOffset[mi];
    const vEnd = mi + 1 < meshCount ? MeshVertexOffset[mi + 1] : vertexCount;
    const vCount = vEnd - vStart;
    if (iCount === 0 || vCount === 0)
      continue;
    const indexArray = IndexBuffer.subarray(iStart, iEnd);
    const vertexMultiplier = 1e4;
    const positionArray = new Float32Array(vCount * 3);
    for (let vi = 0; vi < vCount; vi++) {
      positionArray[vi * 3 + 0] = VertexX[vi + vStart] / vertexMultiplier;
      positionArray[vi * 3 + 1] = VertexY[vi + vStart] / vertexMultiplier;
      positionArray[vi * 3 + 2] = VertexZ[vi + vStart] / vertexMultiplier;
    }
    const geom = new BufferGeometry();
    geom.setAttribute("position", new BufferAttribute(positionArray, 3));
    geom.setIndex(new BufferAttribute(indexArray, 1));
    geom.computeVertexNormals();
    meshGeometries[mi] = geom;
  }
  return meshGeometries;
}
function computeMeshGeometriesFromPrecomputed(bim, meshPositions, meshNormals) {
  const meshCount = bim.MeshVertexOffset.length;
  const indexCount = bim.IndexBuffer.length;
  const meshGeometries = new Array(meshCount);
  for (let mi = 0; mi < meshCount; mi++) {
    const pos = meshPositions[mi];
    const normal = meshNormals[mi];
    if (!pos || !normal)
      continue;
    const iStart = bim.MeshIndexOffset[mi];
    const iEnd = mi + 1 < meshCount ? bim.MeshIndexOffset[mi + 1] : indexCount;
    const indexArray = bim.IndexBuffer.subarray(iStart, iEnd);
    if (indexArray.length === 0)
      continue;
    const geom = new BufferGeometry();
    geom.setAttribute("position", new BufferAttribute(pos, 3));
    geom.setAttribute("normal", new BufferAttribute(normal, 3));
    geom.setIndex(new BufferAttribute(indexArray, 1));
    meshGeometries[mi] = geom;
  }
  return meshGeometries;
}
function computeMaterials(bim) {
  const numMaterials = bim.MaterialAlpha.length;
  const materials = new Array(numMaterials);
  for (let mi = 0; mi < numMaterials; mi++) {
    const r = bim.MaterialRed[mi] / 255;
    const g = bim.MaterialGreen[mi] / 255;
    const b = bim.MaterialBlue[mi] / 255;
    const a = bim.MaterialAlpha[mi] / 255;
    const roughness = bim.MaterialRoughness[mi] / 255;
    const metalness = bim.MaterialMetallic[mi] / 255;
    const mat = new MeshStandardMaterial({
      color: new Color(r, g, b),
      opacity: a,
      flatShading: true,
      transparent: a < 0.999,
      roughness,
      metalness,
      side: DoubleSide
    });
    mat.Id = mi;
    materials[mi] = mat;
  }
  return materials;
}
function computeTransforms(bim) {
  const {
    TransformTX,
    TransformTY,
    TransformTZ,
    TransformQX,
    TransformQY,
    TransformQZ,
    TransformQW,
    TransformSX,
    TransformSY,
    TransformSZ
  } = bim;
  const tmpPos = new Vector3();
  const tmpQuat = new Quaternion();
  const tmpScale = new Vector3();
  const transformCount = TransformTX.length;
  const matrices = new Array(transformCount);
  for (let ti = 0; ti < transformCount; ti++) {
    const tx = TransformTX[ti];
    const ty = TransformTY[ti];
    const tz = TransformTZ[ti];
    const sx = TransformSX[ti];
    const sy = TransformSY[ti];
    const sz = TransformSZ[ti];
    const qx = TransformQX[ti];
    const qy = TransformQY[ti];
    const qz = TransformQZ[ti];
    const qw = TransformQW[ti];
    const m = new Matrix4();
    tmpPos.set(tx, ty, tz);
    tmpQuat.set(qx, qy, qz, qw);
    tmpScale.set(sx, sy, sz);
    m.compose(tmpPos, tmpQuat, tmpScale);
    matrices[ti] = m;
  }
  return matrices;
}
function computeTransformsFromPacked(matrices, identityFlags) {
  const transformCount = identityFlags.length;
  const transforms = new Array(transformCount);
  for (let ti = 0; ti < transformCount; ti++) {
    const offset = ti * 16;
    const m = new Matrix4();
    m.fromArray(matrices, offset);
    transforms[ti] = m;
  }
  return { transforms, identityByIndex: identityFlags };
}
function buildInstancesFromPrecomputed(bg, meshPositions, meshNormals, transformMatrices, transformIdentity) {
  console.time("Building instances");
  const { transforms, identityByIndex } = computeTransformsFromPacked(
    transformMatrices,
    transformIdentity
  );
  const geometries = computeMeshGeometriesFromPrecomputed(bg, meshPositions, meshNormals);
  const materials = computeMaterials(bg);
  const instanceCount = bg.InstanceMeshIndex.length;
  const instances = new Array(instanceCount);
  for (let i = 0; i < instanceCount; i++) {
    const meshIndex = bg.InstanceMeshIndex[i];
    if (meshIndex < 0)
      continue;
    const flag = bg.InstanceFlags[i];
    if (flag & 1)
      continue;
    const geometry = geometries[meshIndex];
    if (!geometry)
      continue;
    const material = materials[bg.InstanceMaterialIndex[i]];
    const transformIndex = bg.InstanceTransformIndex[i];
    const transform = transforms[transformIndex];
    const entity = bg.InstanceEntityIndex[i];
    instances[i] = {
      instance: i,
      geometry,
      material,
      materialId: bg.InstanceMaterialIndex[i],
      transform,
      entity,
      isIdentity: identityByIndex[transformIndex] === 1
    };
  }
  console.timeEnd("Building instances");
  return instances;
}
function collectTaskTransfers(tasks) {
  const transfers = [];
  for (const task of tasks) {
    for (const instance of task.instances) {
      transfers.push(instance.transform.buffer);
      transfers.push(instance.positions.buffer);
      transfers.push(instance.indices.buffer);
    }
  }
  return transfers;
}
class BuildGeometryMergeWorkerClient {
  constructor() {
    __publicField(this, "worker");
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "nextRequestId", 1);
    this.worker = new WorkerWrapper$1();
    this.worker.onmessage = (event) => {
      const message = event.data;
      const pending = this.pending.get(message.id);
      if (!pending)
        return;
      this.pending.delete(message.id);
      if (message.type === "done") {
        pending.resolve(message.results);
        return;
      }
      pending.reject(new Error(message.message));
    };
    this.worker.onerror = (event) => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error(event.message || "buildGeometry merge worker crashed"));
      }
      this.pending.clear();
    };
  }
  merge(tasks) {
    if (tasks.length === 0)
      return Promise.resolve([]);
    const id = this.nextRequestId++;
    const transfers = collectTaskTransfers(tasks);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({
        id,
        type: "merge",
        tasks
      }, transfers);
    });
  }
  dispose() {
    for (const pending of this.pending.values()) {
      pending.reject(new Error("buildGeometry merge worker disposed"));
    }
    this.pending.clear();
    this.worker.terminate();
  }
}
let mergeWorkerClient = null;
function getMergeWorkerClient() {
  if (!mergeWorkerClient) {
    mergeWorkerClient = new BuildGeometryMergeWorkerClient();
  }
  return mergeWorkerClient;
}
function buildGeometry(instances) {
  const startedAt = perfNow();
  const groupingStartedAt = perfNow();
  const root = new Group();
  const instanceGroups = groupInstances(instances);
  const groupingDurationMs = perfDuration(
    "buildGeometry.groupInstances",
    groupingStartedAt
  );
  const gatherStartedAt = perfNow();
  const materialGroups = gatherSingleInstancesByMaterial(instanceGroups);
  const gatherDurationMs = perfDuration(
    "buildGeometry.gatherSingleInstancesByMaterial",
    gatherStartedAt
  );
  const instancedStartedAt = perfNow();
  const instancedMeshes = createInstancedMeshes(instanceGroups);
  const instancedDurationMs = perfDuration(
    "buildGeometry.createInstancedMeshes",
    instancedStartedAt,
    { instancedCount: instancedMeshes.length }
  );
  const mergedStartedAt = perfNow();
  const nonInstancedMeshes = createMergedAndSingleMeshes(materialGroups);
  const mergedDurationMs = perfDuration(
    "buildGeometry.createMergedAndSingleMeshes",
    mergedStartedAt,
    { nonInstancedCount: nonInstancedMeshes.length }
  );
  let polyCount = 0;
  for (const im of instancedMeshes) {
    polyCount += im.geometry.index.count / 3 * im.count;
    root.add(im);
  }
  for (const nim of nonInstancedMeshes) {
    polyCount += nim.geometry.index.count / 3;
    root.add(nim);
  }
  root.rotation.x = -Math.PI / 2;
  const durationMs = perfDuration("buildGeometry.total", startedAt, {
    sourceInstanceCount: instances.length,
    groupedMaterialCount: instanceGroups.size,
    materialGroupCount: materialGroups.length,
    instancedMeshCount: instancedMeshes.length,
    nonInstancedMeshCount: nonInstancedMeshes.length,
    polyCount,
    groupingDurationMs,
    gatherDurationMs,
    instancedDurationMs,
    mergedDurationMs
  });
  perfLongTask("buildGeometry.longTask", startedAt, 50, {
    sourceInstanceCount: instances.length,
    polyCount,
    durationMs
  });
  return root;
}
async function buildGeometryAsync(instances) {
  const startedAt = perfNow();
  const groupingStartedAt = perfNow();
  const root = new Group();
  const instanceGroups = groupInstances(instances);
  const groupingDurationMs = perfDuration("buildGeometry.groupInstances", groupingStartedAt);
  const gatherStartedAt = perfNow();
  const materialGroups = gatherSingleInstancesByMaterial(instanceGroups);
  const gatherDurationMs = perfDuration(
    "buildGeometry.gatherSingleInstancesByMaterial",
    gatherStartedAt
  );
  const instancedStartedAt = perfNow();
  const instancedMeshes = createInstancedMeshes(instanceGroups);
  const instancedDurationMs = perfDuration("buildGeometry.createInstancedMeshes", instancedStartedAt, {
    instancedCount: instancedMeshes.length
  });
  const mergedStartedAt = perfNow();
  const nonInstancedMeshes = await createMergedAndSingleMeshesAsync(materialGroups);
  const mergedDurationMs = perfDuration("buildGeometry.createMergedAndSingleMeshes", mergedStartedAt, {
    nonInstancedCount: nonInstancedMeshes.length
  });
  let polyCount = 0;
  for (const im of instancedMeshes) {
    polyCount += im.geometry.index.count / 3 * im.count;
    root.add(im);
  }
  for (const nim of nonInstancedMeshes) {
    polyCount += nim.geometry.index.count / 3;
    root.add(nim);
  }
  root.rotation.x = -Math.PI / 2;
  const durationMs = perfDuration("buildGeometry.total", startedAt, {
    sourceInstanceCount: instances.length,
    groupedMaterialCount: instanceGroups.size,
    materialGroupCount: materialGroups.length,
    instancedMeshCount: instancedMeshes.length,
    nonInstancedMeshCount: nonInstancedMeshes.length,
    polyCount,
    groupingDurationMs,
    gatherDurationMs,
    instancedDurationMs,
    mergedDurationMs
  });
  perfLongTask("buildGeometry.longTask", startedAt, 50, {
    sourceInstanceCount: instances.length,
    polyCount,
    durationMs
  });
  return root;
}
function createMergedAndSingleMeshes(materialGroups) {
  const r = [];
  for (const materialGroup of materialGroups) {
    const n = materialGroup.instances.length;
    if (n === 0)
      continue;
    const material = materialGroup.material;
    if (n === 1) {
      const i = materialGroup.instances[0];
      const mesh = new Mesh(i.geometry, i.material);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(i.transform);
      mesh.userData.pick = {
        kind: "single",
        instanceIndex: i.instance
      };
      r.push(mesh);
      continue;
    }
    const geomsToMerge = [];
    const instanceIndices = [];
    for (const i of materialGroup.instances) {
      const geom = i.isIdentity ? i.geometry : i.geometry.clone().applyMatrix4(i.transform);
      geomsToMerge.push(geom);
      instanceIndices.push(i.instance);
    }
    const { geometry: mergedGeometry, triToInstanceIndex } = mergeGeometries(geomsToMerge);
    const mergedMesh = new Mesh(mergedGeometry, material);
    mergedMesh.name = `MergedStatic_Material_${material.Id}`;
    const triToInstanceIndexMap = new Uint32Array(triToInstanceIndex.length);
    for (let i = 0; i < triToInstanceIndex.length; i++) {
      triToInstanceIndexMap[i] = instanceIndices[triToInstanceIndex[i]];
    }
    mergedMesh.userData.pick = {
      kind: "merged",
      triToInstanceIndex: triToInstanceIndexMap
    };
    r.push(mergedMesh);
  }
  return r;
}
async function createMergedAndSingleMeshesAsync(materialGroups) {
  const result = [];
  const mergeTasks = [];
  const mergeTaskMaterialById = /* @__PURE__ */ new Map();
  let taskId = 0;
  for (const materialGroup of materialGroups) {
    const n = materialGroup.instances.length;
    if (n === 0)
      continue;
    if (n === 1) {
      const i = materialGroup.instances[0];
      const mesh = new Mesh(i.geometry, i.material);
      mesh.matrixAutoUpdate = false;
      mesh.matrix.copy(i.transform);
      mesh.userData.pick = {
        kind: "single",
        instanceIndex: i.instance
      };
      result.push(mesh);
      continue;
    }
    const taskInstances = [];
    for (const instance of materialGroup.instances) {
      const posAttr = instance.geometry.getAttribute("position");
      const indexAttr = instance.geometry.getIndex();
      if (!posAttr || !indexAttr)
        continue;
      taskInstances.push({
        instanceIndex: instance.instance,
        isIdentity: instance.isIdentity,
        transform: new Float32Array(instance.transform.elements),
        positions: new Float32Array(posAttr.array.slice()),
        indices: new Uint32Array(indexAttr.array.slice())
      });
    }
    if (taskInstances.length < 2) {
      for (const instance of materialGroup.instances) {
        const mesh = new Mesh(instance.geometry, instance.material);
        mesh.matrixAutoUpdate = false;
        mesh.matrix.copy(instance.transform);
        mesh.userData.pick = {
          kind: "single",
          instanceIndex: instance.instance
        };
        result.push(mesh);
      }
      continue;
    }
    mergeTaskMaterialById.set(taskId, materialGroup.material);
    mergeTasks.push({
      taskId,
      instances: taskInstances
    });
    taskId++;
  }
  const mergedResults = await getMergeWorkerClient().merge(mergeTasks);
  for (const merged of mergedResults) {
    const material = mergeTaskMaterialById.get(merged.taskId);
    if (!material)
      continue;
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(merged.mergedPositions, 3));
    geometry.setIndex(new BufferAttribute(merged.mergedIndices, 1));
    const mesh = new Mesh(geometry, material);
    mesh.name = `MergedStatic_Material_${material.Id ?? "unknown"}`;
    mesh.userData.pick = {
      kind: "merged",
      triToInstanceIndex: merged.triToInstanceIndex
    };
    result.push(mesh);
  }
  return result;
}
function mergeGeometries(geometries) {
  let indexCount = 0;
  let posCount = 0;
  for (let i = 0, l = geometries.length; i < l; i++) {
    const geometry = geometries[i];
    const index = geometry.getIndex();
    const position = geometry.getAttribute("position");
    indexCount += index.count;
    posCount += position.count;
  }
  const mergedPositions = new Float32Array(posCount * 3);
  const mergedIndices = new Uint32Array(indexCount);
  const triToInstanceIndex = new Uint32Array(indexCount / 3);
  let indexOffset = 0;
  let vertexOffset = 0;
  for (let i = 0, l = geometries.length; i < l; i++) {
    const geometry = geometries[i];
    const posAttr = geometry.getAttribute("position");
    const indexAttr = geometry.getIndex();
    const srcPosArray = posAttr.array;
    const srcIndexArray = indexAttr.array;
    const vertCount = posAttr.count;
    const idxCount = indexAttr.count;
    const posItemSize = posAttr.itemSize;
    const triCount = idxCount / 3;
    const srcPosLength = vertCount * posItemSize;
    const dstPosOffset = vertexOffset * posItemSize;
    mergedPositions.set(
      srcPosArray.subarray(0, srcPosLength),
      dstPosOffset
    );
    for (let j = 0; j < idxCount; j++)
      mergedIndices[indexOffset + j] = srcIndexArray[j] + vertexOffset;
    const triStart = indexOffset / 3;
    for (let triIdx = 0; triIdx < triCount; triIdx++) {
      triToInstanceIndex[triStart + triIdx] = i;
    }
    vertexOffset += vertCount;
    indexOffset += idxCount;
  }
  const mergedGeom = new BufferGeometry();
  mergedGeom.setAttribute("position", new BufferAttribute(mergedPositions, 3));
  mergedGeom.setIndex(new BufferAttribute(mergedIndices, 1));
  return { geometry: mergedGeom, triToInstanceIndex };
}
function groupInstances(instances) {
  const groups = /* @__PURE__ */ new Map();
  for (const inst of instances) {
    if (!inst)
      continue;
    let matGroup = groups.get(inst.material);
    if (!matGroup) {
      matGroup = /* @__PURE__ */ new Map();
      groups.set(inst.material, matGroup);
    }
    let meshGroup = matGroup.get(inst.geometry);
    if (!meshGroup) {
      meshGroup = [];
      matGroup.set(inst.geometry, meshGroup);
    }
    meshGroup.push(inst);
  }
  return groups;
}
function gatherSingleInstancesByMaterial(groups) {
  const r = new Array();
  for (const [material, meshGroups] of groups) {
    let instances = [];
    for (const [, group] of meshGroups) {
      if (group.length != 1)
        continue;
      instances.push(group[0]);
    }
    if (instances.length < 1)
      continue;
    r.push({ material, instances });
  }
  return r;
}
function createInstancedMeshes(instanceGroups) {
  const r = new Array();
  for (const [material, meshGroups] of instanceGroups) {
    for (const [geometry, instances] of meshGroups) {
      const count = instances.length;
      if (count <= 1)
        continue;
      const instanced = new InstancedMesh(geometry, material, count);
      instanced.instanceMatrix.setUsage(StaticDrawUsage);
      const instanceIndices = new Uint32Array(count);
      for (let i = 0; i < count; i++) {
        instanced.setMatrixAt(i, instances[i].transform);
        instanceIndices[i] = instances[i].instance;
      }
      instanced.frustumCulled = false;
      instanced.matrixAutoUpdate = false;
      instanced.matrixWorldNeedsUpdate = false;
      instanced.userData.pick = {
        kind: "instanced",
        instanceIndices
      };
      r.push(instanced);
    }
  }
  return r;
}
function splitBuckets(instances) {
  const opaque = [];
  const transparent = [];
  for (const instance of instances) {
    if (!instance)
      continue;
    const mat = instance.material;
    if (mat.transparent || mat.opacity < 0.999) {
      transparent.push(instance);
      continue;
    }
    opaque.push(instance);
  }
  return { opaque, transparent };
}
function groupKey(instance) {
  return `${instance.materialId}:${instance.geometry.uuid}`;
}
function mergeInstances(instances) {
  let indexCount = 0;
  let vertexCount = 0;
  for (const instance of instances) {
    const posAttr = instance.geometry.getAttribute("position");
    const normalAttr = instance.geometry.getAttribute("normal");
    const idxAttr = instance.geometry.getIndex();
    if (!posAttr || !normalAttr || !idxAttr)
      continue;
    vertexCount += posAttr.count;
    indexCount += idxAttr.count;
  }
  if (vertexCount === 0 || indexCount === 0)
    return null;
  const mergedPositions = new Float32Array(vertexCount * 3);
  const mergedNormals = new Float32Array(vertexCount * 3);
  const mergedIndices = new Uint32Array(indexCount);
  const instanceIds = new Float32Array(vertexCount);
  const materialIds = new Float32Array(vertexCount);
  const normalMatrix = new Matrix3();
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const instance of instances) {
    const posAttr = instance.geometry.getAttribute("position");
    const normalAttr = instance.geometry.getAttribute("normal");
    const idxAttr = instance.geometry.getIndex();
    if (!posAttr || !normalAttr || !idxAttr)
      continue;
    const srcPos = posAttr.array;
    const srcNormal = normalAttr.array;
    const srcIndex = idxAttr.array;
    const count = posAttr.count;
    const srcLen = count * 3;
    const dstBase = vertexOffset * 3;
    for (let i = 0; i < count; i++) {
      instanceIds[vertexOffset + i] = instance.instance;
      materialIds[vertexOffset + i] = instance.materialId;
    }
    if (instance.isIdentity) {
      mergedPositions.set(srcPos.subarray(0, srcLen), dstBase);
      mergedNormals.set(srcNormal.subarray(0, srcLen), dstBase);
    } else {
      const m = instance.transform.elements;
      const m00 = m[0], m01 = m[4], m02 = m[8], m03 = m[12];
      const m10 = m[1], m11 = m[5], m12 = m[9], m13 = m[13];
      const m20 = m[2], m21 = m[6], m22 = m[10], m23 = m[14];
      normalMatrix.getNormalMatrix(instance.transform);
      const nm = normalMatrix.elements;
      const n00 = nm[0], n01 = nm[3], n02 = nm[6];
      const n10 = nm[1], n11 = nm[4], n12 = nm[7];
      const n20 = nm[2], n21 = nm[5], n22 = nm[8];
      for (let i = 0; i < count; i++) {
        const srcBase = i * 3;
        const outBase = dstBase + srcBase;
        const x = srcPos[srcBase];
        const y = srcPos[srcBase + 1];
        const z = srcPos[srcBase + 2];
        mergedPositions[outBase] = m00 * x + m01 * y + m02 * z + m03;
        mergedPositions[outBase + 1] = m10 * x + m11 * y + m12 * z + m13;
        mergedPositions[outBase + 2] = m20 * x + m21 * y + m22 * z + m23;
        const nx = srcNormal[srcBase];
        const ny = srcNormal[srcBase + 1];
        const nz = srcNormal[srcBase + 2];
        mergedNormals[outBase] = n00 * nx + n01 * ny + n02 * nz;
        mergedNormals[outBase + 1] = n10 * nx + n11 * ny + n12 * nz;
        mergedNormals[outBase + 2] = n20 * nx + n21 * ny + n22 * nz;
      }
    }
    for (let i = 0; i < idxAttr.count; i++) {
      mergedIndices[indexOffset + i] = srcIndex[i] + vertexOffset;
    }
    vertexOffset += count;
    indexOffset += idxAttr.count;
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(mergedPositions, 3));
  geometry.setAttribute("normal", new BufferAttribute(mergedNormals, 3));
  geometry.setAttribute("instanceId", new Float32BufferAttribute(instanceIds, 1));
  geometry.setAttribute("materialId", new Float32BufferAttribute(materialIds, 1));
  geometry.setIndex(new BufferAttribute(mergedIndices, 1));
  const mesh = new Mesh(geometry, new MeshBasicMaterial());
  mesh.frustumCulled = false;
  mesh.matrixAutoUpdate = false;
  mesh.userData.pick = { kind: "viewStateMerged" };
  return mesh;
}
function buildHybridBucket(instances) {
  const grouped = /* @__PURE__ */ new Map();
  for (const instance of instances) {
    const key = groupKey(instance);
    const group = grouped.get(key);
    if (group) {
      group.push(instance);
    } else {
      grouped.set(key, [instance]);
    }
  }
  const instancedMeshes = [];
  const singleByMaterial = /* @__PURE__ */ new Map();
  for (const groupedInstances of grouped.values()) {
    if (groupedInstances.length === 0)
      continue;
    const first = groupedInstances[0];
    const count = groupedInstances.length;
    if (count <= 1) {
      const list = singleByMaterial.get(first.materialId);
      if (list) {
        list.push(first);
      } else {
        singleByMaterial.set(first.materialId, [first]);
      }
      continue;
    }
    const geometry = first.geometry.clone();
    const instanced = new InstancedMesh(geometry, new MeshBasicMaterial(), count);
    instanced.instanceMatrix.setUsage(StaticDrawUsage);
    const instanceIds = new Float32Array(count);
    const materialIds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const item = groupedInstances[i];
      instanced.setMatrixAt(i, item.transform);
      instanceIds[i] = item.instance;
      materialIds[i] = item.materialId;
    }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.geometry.setAttribute("instanceId", new InstancedBufferAttribute(instanceIds, 1));
    instanced.geometry.setAttribute("materialId", new InstancedBufferAttribute(materialIds, 1));
    instanced.frustumCulled = false;
    instanced.matrixAutoUpdate = false;
    instanced.userData.pick = {
      kind: "instanced",
      instanceIndices: Array.from(instanceIds)
    };
    instancedMeshes.push(instanced);
  }
  const mergedSingleMeshes = [];
  for (const groupedSingles of singleByMaterial.values()) {
    const merged = mergeInstances(groupedSingles);
    if (merged)
      mergedSingleMeshes.push(merged);
  }
  return { meshes: [...instancedMeshes, ...mergedSingleMeshes] };
}
function buildViewStateBuckets(instances) {
  const startedAt = perfNow();
  const split = splitBuckets(instances);
  const opaque = buildHybridBucket(split.opaque);
  const transparent = buildHybridBucket(split.transparent);
  perfDuration("viewState.buildBuckets", startedAt, {
    sourceCount: instances.length,
    opaqueCount: split.opaque.length,
    transparentCount: split.transparent.length
  });
  return { opaque, transparent };
}
function setViewStateMaterialSelectionColor(material, color) {
  if (!material)
    return;
  const uniforms = material.userData.viewStateSelectionUniforms;
  if (!uniforms)
    return;
  uniforms.color.set(color);
}
function createViewStateMaterial(options) {
  const selectionUniforms = {
    color: new Color(16776960),
    mix: 1
  };
  const material = new MeshStandardMaterial({
    color: 16777215,
    roughness: 0.7,
    metalness: 0.1,
    transparent: options.transparentPass,
    depthWrite: !options.transparentPass,
    side: DoubleSide
  });
  material.userData.viewStateSelectionUniforms = selectionUniforms;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBaseMaterialTex = {
      value: options.textures.baseMaterial
    };
    shader.uniforms.uViewFlagsTex = { value: options.textures.flags };
    shader.uniforms.uColorOverridesTex = {
      value: options.textures.colorOverrides
    };
    shader.uniforms.uSelectionColor = { value: selectionUniforms.color };
    shader.uniforms.uSelectionMix = { value: selectionUniforms.mix };
    shader.uniforms.uInstanceCount = {
      value: Math.max(1, options.instanceCount)
    };
    shader.uniforms.uMaterialCount = {
      value: Math.max(1, options.materialCount)
    };
    shader.uniforms.uViewFlagsTexWidth = {
      value: Math.max(1, options.textures.flags.image.width)
    };
    shader.uniforms.uViewFlagsTexHeight = {
      value: Math.max(1, options.textures.flags.image.height)
    };
    shader.uniforms.uColorOverridesTexWidth = {
      value: Math.max(1, options.textures.colorOverrides.image.width)
    };
    shader.uniforms.uColorOverridesTexHeight = {
      value: Math.max(1, options.textures.colorOverrides.image.height)
    };
    shader.uniforms.uBaseMaterialTexWidth = {
      value: Math.max(1, options.textures.baseMaterial.image.width)
    };
    shader.uniforms.uBaseMaterialTexHeight = {
      value: Math.max(1, options.textures.baseMaterial.image.height)
    };
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
attribute float instanceId;
attribute float materialId;
varying float vInstanceId;
varying float vMaterialId;`
    ).replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vInstanceId = instanceId;
vMaterialId = materialId;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
uniform sampler2D uBaseMaterialTex;
uniform sampler2D uViewFlagsTex;
uniform sampler2D uColorOverridesTex;
uniform vec3 uSelectionColor;
uniform float uSelectionMix;
uniform float uInstanceCount;
uniform float uMaterialCount;
uniform float uViewFlagsTexWidth;
uniform float uViewFlagsTexHeight;
uniform float uColorOverridesTexWidth;
uniform float uColorOverridesTexHeight;
uniform float uBaseMaterialTexWidth;
uniform float uBaseMaterialTexHeight;
varying float vInstanceId;
varying float vMaterialId;

vec4 sampleLookupPacked(sampler2D t, float id, float width, float height) {
    float ix = mod(id, width);
    float iy = floor(id / width);
    vec2 uv = vec2((ix + 0.5) / width, (iy + 0.5) / height);
    return texture2D(t, uv);
}`
    ).replace(
      "vec4 diffuseColor = vec4( diffuse, opacity );",
      `vec4 baseMaterial = sampleLookupPacked(
    uBaseMaterialTex,
    vMaterialId,
    uBaseMaterialTexWidth,
    uBaseMaterialTexHeight
);
vec4 stateFlags = sampleLookupPacked(
    uViewFlagsTex,
    vInstanceId,
    uViewFlagsTexWidth,
    uViewFlagsTexHeight
);
vec4 colorOverride = sampleLookupPacked(
    uColorOverridesTex,
    vInstanceId,
    uColorOverridesTexWidth,
    uColorOverridesTexHeight
);

float rawFlags = floor(stateFlags.r * 255.0 + 0.5);
bool isVisible = mod(rawFlags, 2.0) >= 1.0;
bool isSelected = mod(floor(rawFlags / 2.0), 2.0) >= 1.0;
bool isGhosted = mod(floor(rawFlags / 4.0), 2.0) >= 1.0;

vec3 finalBaseColor = baseMaterial.rgb;
float finalOpacity = baseMaterial.a;

if (colorOverride.a > 0.5) {
    finalBaseColor = colorOverride.rgb;
}

if (isGhosted) {
    finalOpacity = min(finalOpacity, 0.2);
}

if (isSelected) {
    float fillMix = clamp(uSelectionMix, 0.0, 1.0);
    finalBaseColor = mix(finalBaseColor, uSelectionColor, fillMix);
}

if (!isVisible) {
    discard;
}

vec4 diffuseColor = vec4(finalBaseColor, finalOpacity);`
    );
  };
  material.customProgramCacheKey = () => `view-state-${options.transparentPass ? "transparent" : "opaque"}-v3`;
  return material;
}
var ViewStateFlag = /* @__PURE__ */ ((ViewStateFlag2) => {
  ViewStateFlag2[ViewStateFlag2["Visible"] = 1] = "Visible";
  ViewStateFlag2[ViewStateFlag2["Selected"] = 2] = "Selected";
  ViewStateFlag2[ViewStateFlag2["Ghosted"] = 4] = "Ghosted";
  return ViewStateFlag2;
})(ViewStateFlag || {});
function buildPackedTextureData(entryCount) {
  const safeEntryCount = Math.max(1, entryCount);
  const maxWidth = 2048;
  const width = Math.min(maxWidth, safeEntryCount);
  const height = Math.ceil(safeEntryCount / width);
  return {
    width,
    height,
    data: new Uint8Array(width * height * 4)
  };
}
function setupNearest(texture) {
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
function buildViewStateTextures(options) {
  const packedFlags = buildPackedTextureData(options.instanceCount);
  const packedOverrides = buildPackedTextureData(options.instanceCount);
  const packedBaseMaterials = buildPackedTextureData(options.materialCount);
  const flagsData = packedFlags.data;
  for (let i = 0; i < options.instanceCount; i++) {
    flagsData[i * 4] = ViewStateFlag.Visible;
  }
  const colorOverridesData = packedOverrides.data;
  packedBaseMaterials.data.set(options.baseMaterialColors.subarray(0, options.materialCount * 4), 0);
  const flags = setupNearest(
    new DataTexture(
      flagsData,
      packedFlags.width,
      packedFlags.height,
      RGBAFormat,
      UnsignedByteType
    )
  );
  const colorOverrides = setupNearest(
    new DataTexture(
      colorOverridesData,
      packedOverrides.width,
      packedOverrides.height,
      RGBAFormat,
      UnsignedByteType
    )
  );
  const baseMaterial = setupNearest(
    new DataTexture(
      packedBaseMaterials.data,
      packedBaseMaterials.width,
      packedBaseMaterials.height,
      RGBAFormat,
      UnsignedByteType
    )
  );
  return {
    baseMaterial,
    flags,
    colorOverrides
  };
}
class ViewStateTable {
  constructor(textures, instanceCount) {
    __publicField(this, "flagsData");
    __publicField(this, "colorOverridesData");
    __publicField(this, "instanceCount");
    __publicField(this, "textures");
    this.textures = textures;
    this.instanceCount = instanceCount;
    this.flagsData = textures.flags.image.data;
    this.colorOverridesData = textures.colorOverrides.image.data;
  }
  setVisibility(instanceIds, visible) {
    this.applyFlag(instanceIds, ViewStateFlag.Visible, visible);
  }
  setSelected(instanceIds, selected) {
    this.applyFlag(instanceIds, ViewStateFlag.Selected, selected);
  }
  setGhosted(instanceIds, ghosted) {
    this.applyFlag(instanceIds, ViewStateFlag.Ghosted, ghosted);
  }
  setColorOverride(instanceIds, color) {
    const startedAt = perfNow();
    for (const instanceId of instanceIds) {
      if (instanceId < 0 || instanceId >= this.instanceCount)
        continue;
      const base = instanceId * 4;
      if (!color) {
        this.colorOverridesData[base + 0] = 0;
        this.colorOverridesData[base + 1] = 0;
        this.colorOverridesData[base + 2] = 0;
        this.colorOverridesData[base + 3] = 0;
        continue;
      }
      this.colorOverridesData[base + 0] = Math.round(color.r * 255);
      this.colorOverridesData[base + 1] = Math.round(color.g * 255);
      this.colorOverridesData[base + 2] = Math.round(color.b * 255);
      this.colorOverridesData[base + 3] = 255;
    }
    this.textures.colorOverrides.needsUpdate = true;
    perfDuration("viewState.colorOverride", startedAt, {
      count: instanceIds.length
    });
  }
  clearColorOverrides(instanceIds) {
    this.setColorOverride(instanceIds, null);
  }
  applyPendingGpuUpdates() {
    this.textures.flags.needsUpdate = true;
    this.textures.colorOverrides.needsUpdate = true;
  }
  applyFlag(instanceIds, flag, enabled) {
    const startedAt = perfNow();
    for (const instanceId of instanceIds) {
      if (instanceId < 0 || instanceId >= this.instanceCount)
        continue;
      const offset = instanceId * 4;
      const current = this.flagsData[offset];
      this.flagsData[offset] = enabled ? current | flag : current & ~flag;
    }
    this.textures.flags.needsUpdate = true;
    perfDuration("viewState.flagPatch", startedAt, {
      count: instanceIds.length,
      flag,
      enabled
    });
  }
}
function buildBaseMaterialLookup(instances) {
  let maxMaterialId = -1;
  for (const instance of instances) {
    if (!instance)
      continue;
    maxMaterialId = Math.max(maxMaterialId, instance.materialId);
  }
  const materialCount = Math.max(1, maxMaterialId + 1);
  const data = new Uint8Array(materialCount * 4);
  for (const instance of instances) {
    if (!instance)
      continue;
    const mat = instance.material;
    const offset = instance.materialId * 4;
    data[offset] = Math.round(mat.color.r * 255);
    data[offset + 1] = Math.round(mat.color.g * 255);
    data[offset + 2] = Math.round(mat.color.b * 255);
    data[offset + 3] = Math.round((mat.opacity ?? 1) * 255);
  }
  return { data, materialCount };
}
function buildViewStateRuntime(instances) {
  const startedAt = perfNow();
  const { opaque, transparent } = buildViewStateBuckets(instances);
  const { data: baseMaterialLookup, materialCount } = buildBaseMaterialLookup(instances);
  const instanceCount = instances.length;
  const textures = buildViewStateTextures({
    instanceCount,
    materialCount,
    baseMaterialColors: baseMaterialLookup
  });
  const materialOpaque = createViewStateMaterial({
    textures,
    instanceCount,
    materialCount,
    transparentPass: false
  });
  const materialTransparent = createViewStateMaterial({
    textures,
    instanceCount,
    materialCount,
    transparentPass: true
  });
  const group = new Group();
  group.name = "ViewStateRoot";
  group.rotation.x = -Math.PI / 2;
  for (let i = 0; i < opaque.meshes.length; i++) {
    const meshOpaque = opaque.meshes[i];
    meshOpaque.material = materialOpaque;
    meshOpaque.name = `ViewStateOpaqueBucket_${i}`;
    group.add(meshOpaque);
  }
  for (let i = 0; i < transparent.meshes.length; i++) {
    const meshTransparent = transparent.meshes[i];
    meshTransparent.material = materialTransparent;
    meshTransparent.name = `ViewStateTransparentBucket_${i}`;
    meshTransparent.renderOrder = 10;
    group.add(meshTransparent);
  }
  const state = new ViewStateTable(textures, instanceCount);
  const model = {
    group,
    textures,
    materialOpaque,
    materialTransparent
  };
  perfDuration("viewState.buildRuntime", startedAt, {
    instanceCount,
    materialCount,
    bucketCount: group.children.length
  });
  return { model, state };
}
class BimData {
  constructor() {
    __publicField(this, "BimGeometry");
    __publicField(this, "Entities");
    __publicField(this, "Strings");
    __publicField(this, "ThreeGeometry");
    __publicField(this, "Resolver");
    __publicField(this, "Query");
    __publicField(this, "Instances");
    __publicField(this, "ViewState", null);
    __publicField(this, "Descriptors");
    __publicField(this, "IntegerParameters");
    __publicField(this, "StringParameters");
    __publicField(this, "EntityParameters");
    __publicField(this, "SingleParameters");
    __publicField(this, "PointParameters");
  }
  buildViewStateGeometry(instances) {
    const startedAt = perfNow();
    this.ViewState = buildViewStateRuntime(instances);
    perfDuration("bimData.buildViewStateGeometry", startedAt, {
      sourceInstanceCount: instances.length
    });
    return this.ViewState.model.group;
  }
  rebuildGeometry(instances) {
    const startedAt = perfNow();
    const geometry = buildGeometry(instances);
    perfDuration("bimData.rebuildGeometry", startedAt, {
      sourceInstanceCount: instances.length
    });
    perfLongTask("bimData.rebuildGeometry.longTask", startedAt, 50, {
      sourceInstanceCount: instances.length
    });
    return geometry;
  }
  async rebuildGeometryAsync(instances) {
    const startedAt = perfNow();
    const geometry = await buildGeometryAsync(instances);
    perfDuration("bimData.rebuildGeometry", startedAt, {
      sourceInstanceCount: instances.length
    });
    perfLongTask("bimData.rebuildGeometry.longTask", startedAt, 50, {
      sourceInstanceCount: instances.length
    });
    return geometry;
  }
}
class BimResolver {
  constructor(Data) {
    __publicField(this, "Descriptors");
    __publicField(this, "Strings");
    __publicField(this, "Entities");
    __publicField(this, "InstanceCount");
    __publicField(this, "EntityCount");
    __publicField(this, "BimGeometry");
    __publicField(this, "DescriptorCount");
    __publicField(this, "ParameterMap");
    this.Data = Data;
    this.Entities = Data.Entities ?? {};
    this.Strings = Data.Strings ?? [];
    this.BimGeometry = Data.BimGeometry;
    this.InstanceCount = this.BimGeometry.InstanceEntityIndex.length;
    this.EntityCount = this.Entities.Category == null ? 0 : this.Entities.Category.length;
    this.Descriptors = Data.Descriptors;
    this.DescriptorCount = 0;
    this.ParameterMap = /* @__PURE__ */ new Map();
    if (!this.Descriptors) {
      return;
    }
    console.time("Computing parameters");
    this.DescriptorCount = this.Descriptors.Name.length;
    this.ProcessParameters(Data.IntegerParameters);
    this.ProcessParameters(Data.SingleParameters);
    this.ProcessParameters(Data.StringParameters);
    this.ProcessParameters(Data.EntityParameters);
    console.timeEnd("Computing parameters");
    let n = 0;
    n = n + Data.IntegerParameters.Descriptor.length;
    n = n + Data.SingleParameters.Descriptor.length;
    n = n + Data.StringParameters.Descriptor.length;
    n = n + Data.EntityParameters.Descriptor.length;
    console.log("Found %d parameters and %d entitites", n, this.ParameterMap.size);
  }
  GetVal(rawVal, descType) {
    if (descType == 3)
      return this.Strings[rawVal];
    if (descType == 2) {
      if (rawVal >= 0)
        return this.GetEntityName(rawVal);
      return "";
    }
    return rawVal;
  }
  ProcessParameters(table) {
    if (!table || !table.Value || !table.Descriptor || !table.Entity)
      return;
    for (let i = 0; i < table.Value.length; i++) {
      let descIndex = table.Descriptor[i];
      let entityIndex = table.Entity[i];
      let rawVal = table.Value[i];
      if (descIndex < 0)
        continue;
      let nameIndex = this.Descriptors.Name[descIndex];
      let descType = this.Descriptors.Type[descIndex];
      let Value = this.GetVal(rawVal, descType);
      let Name = this.Strings[nameIndex];
      let param = { Name, Value };
      let tmp = this.ParameterMap.get(entityIndex);
      if (tmp === void 0) {
        this.ParameterMap.set(entityIndex, [param]);
      } else {
        tmp.push(param);
      }
    }
  }
  GetString(stringIndex) {
    return this.Strings[stringIndex];
  }
  GetEntityName(i) {
    return this.GetString(this.Entities.Name[i]);
  }
  GetEntityCategory(i) {
    return this.Entities.Category[i];
  }
  GetEntityCategoryName(i) {
    return this.GetEntityName(this.GetEntityCategory(i));
  }
  GetEntityType(i) {
    return this.Entities.Type[i];
  }
  GetEntityTypeName(i) {
    return this.GetEntityName(this.GetEntityType(i));
  }
  GetEntityDocument(i) {
    return this.Entities.Type[i];
  }
  GetEntityDocumentName(i) {
    return this.GetEntityName(this.GetEntityDocument(i));
  }
  GetEntityParameters(i) {
    return this.ParameterMap.get(i);
  }
  GetInstanceName(i) {
    return this.GetEntityName(i.entity);
  }
  GetInstanceCategoryName(i) {
    return this.GetEntityCategoryName(i.entity);
  }
  GetInstanceTypeName(i) {
    return this.GetEntityTypeName(i.entity);
  }
  GetInstanceDocumentName(i) {
    return this.GetEntityDocumentName(i.entity);
  }
  GetInstanceGlobalId(i) {
    return this.GetString(this.Entities.GlobalId[i.entity]);
  }
  GetInstanceParameters(i) {
    return this.GetEntityParameters(i.entity);
  }
  GetDescriptorName(i) {
    return this.GetString(this.Descriptors.Name[i]);
  }
  GetDescriptorType(i) {
    return this.Descriptors.Type[i];
  }
  GetDescriptorGroup(i) {
    return this.GetString(this.Descriptors.Group[i]);
  }
  GetDescriptorUnits(i) {
    return this.GetString(this.Descriptors.Units[i]);
  }
  *EntityIndices() {
    for (let i = 0; i < this.EntityCount; i++)
      yield i;
  }
  *InstanceIndices() {
    for (let i = 0; i < this.InstanceCount; i++)
      yield i;
  }
  *DescriptorIndices() {
    for (let i = 0; i < this.DescriptorCount; i++)
      yield i;
  }
  first(iterable, predicate, _default) {
    for (const value of iterable)
      if (predicate(value))
        return value;
    return _default;
  }
  FindDescriptor(name) {
    return this.first(this.DescriptorIndices(), (i) => this.GetDescriptorName(i) == name, -1);
  }
}
class BimQuery {
  constructor(Data) {
    __publicField(this, "Resolver");
    this.Data = Data;
    this.Resolver = new BimResolver(Data);
  }
  FuncToInstances(f) {
    const r = /* @__PURE__ */ new Map();
    for (const i of this.Resolver.Data.Instances) {
      if (!i)
        continue;
      const s = f(i);
      let list = r.get(s);
      if (!list)
        r.set(s, [i]);
      else
        list.push(i);
    }
    return r;
  }
  CategoryToInstances() {
    return this.FuncToInstances(
      (i) => this.Resolver.GetInstanceCategoryName(i)
    );
  }
  GlobalIdToInstances() {
    return this.FuncToInstances(
      (i) => this.Resolver.GetInstanceGlobalId(i)
    );
  }
  GetLevelFromParameters(ps) {
    if (!ps)
      return null;
    let p = ps.find((p2) => p2.Name == "Rvt:Element:Level");
    if (!p)
      return "";
    return String(p.Value);
  }
  LevelToInstances() {
    return this.FuncToInstances(
      (i) => this.GetLevelFromParameters(this.Resolver.GetInstanceParameters(i))
    );
  }
}
const REQUIRED_GEOMETRY_TABLES = [
  "Instances",
  "VertexBuffer",
  "IndexBuffer",
  "Meshes",
  "Materials",
  "Transforms"
];
const VERTEX_TABLES = ["VertexBuffer"];
const INDEX_TABLES = ["IndexBuffer"];
const OTHER_TABLES_BASE = [
  "Instances",
  "Meshes",
  "Materials",
  "Transforms",
  "Entities",
  "Strings"
];
const PARAMETER_TABLES = [
  "Descriptors",
  "IntegerParameters",
  "SingleParameters",
  "StringParameters",
  "EntityParameters",
  "PointParameters"
];
class BimOpenSchemaWorkerClient {
  constructor(workerTag) {
    __publicField(this, "worker");
    __publicField(this, "workerTag");
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "nextRequestId", 1);
    this.workerTag = workerTag;
    this.worker = new WorkerWrapper$2();
    this.worker.onmessage = (event) => {
      const message = event.data;
      const pendingRequest = this.pending.get(message.id);
      if (!pendingRequest)
        return;
      if (message.type === "progress") {
        console.debug(`[BOS worker] ${message.label}: ${message.durationMs} ms`);
        return;
      }
      if (message.type === "done") {
        this.pending.delete(message.id);
        pendingRequest.resolve(message.payload);
        return;
      }
      this.pending.delete(message.id);
      pendingRequest.reject(new Error(message.message));
    };
    this.worker.onerror = (event) => {
      for (const request of this.pending.values()) {
        request.reject(new Error(event.message || "BOS worker crashed"));
      }
      this.pending.clear();
    };
  }
  decode(files) {
    const id = this.nextRequestId++;
    const message = {
      id,
      type: "decode",
      workerTag: this.workerTag,
      files
    };
    const transfers = Object.values(files);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(message, transfers);
    });
  }
  dispose() {
    for (const request of this.pending.values()) {
      request.reject(new Error("BOS worker disposed"));
    }
    this.pending.clear();
    this.worker.terminate();
  }
}
class BimOpenSchemaZipWorkerClient {
  constructor() {
    __publicField(this, "worker");
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "nextRequestId", 1);
    this.worker = new WorkerWrapper$3();
    this.worker.onmessage = (event) => {
      const message = event.data;
      const pendingRequest = this.pending.get(message.id);
      if (!pendingRequest)
        return;
      if (message.type === "progress") {
        console.debug(`[BOS worker] ${message.label}: ${message.durationMs} ms`);
        return;
      }
      if (message.type === "done") {
        this.pending.delete(message.id);
        pendingRequest.resolve(message.payload);
        return;
      }
      this.pending.delete(message.id);
      pendingRequest.reject(new Error(message.message));
    };
    this.worker.onerror = (event) => {
      for (const request of this.pending.values()) {
        request.reject(new Error(event.message || "BOS zip worker crashed"));
      }
      this.pending.clear();
    };
  }
  extract(source, tables) {
    const id = this.nextRequestId++;
    const message = {
      id,
      type: "zip-load",
      source,
      tables
    };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(message);
    });
  }
  dispose() {
    for (const request of this.pending.values()) {
      request.reject(new Error("BOS zip worker disposed"));
    }
    this.pending.clear();
    this.worker.terminate();
  }
}
let workerClients = null;
let workerClientsOverride = null;
let zipWorkerClient = null;
let zipWorkerClientOverride = null;
function getWorkerClients() {
  if (workerClientsOverride) {
    return workerClientsOverride;
  }
  if (!workerClients) {
    workerClients = {
      vertex: new BimOpenSchemaWorkerClient("vertex"),
      index: new BimOpenSchemaWorkerClient("index"),
      others: new BimOpenSchemaWorkerClient("others")
    };
  }
  return workerClients;
}
function getZipWorkerClient() {
  if (zipWorkerClientOverride) {
    return zipWorkerClientOverride;
  }
  if (!zipWorkerClient) {
    zipWorkerClient = new BimOpenSchemaZipWorkerClient();
  }
  return zipWorkerClient;
}
function materializeBimData(payload) {
  const bimData = new BimData();
  const geometry = {};
  for (const tableName of REQUIRED_GEOMETRY_TABLES) {
    const table = payload[tableName];
    if (!table) {
      throw new Error(`Missing required table "${tableName}" from worker payload.`);
    }
    Object.assign(geometry, table);
  }
  bimData.BimGeometry = geometry;
  if (payload.Entities) {
    bimData.Entities = payload.Entities;
  }
  const stringsValue = payload.Strings?.Strings;
  if (Array.isArray(stringsValue)) {
    bimData.Strings = stringsValue;
  }
  if (payload.Descriptors) {
    bimData.Descriptors = payload.Descriptors;
  }
  if (payload.IntegerParameters) {
    bimData.IntegerParameters = payload.IntegerParameters;
  }
  if (payload.SingleParameters) {
    bimData.SingleParameters = payload.SingleParameters;
  }
  if (payload.StringParameters) {
    bimData.StringParameters = payload.StringParameters;
  }
  if (payload.EntityParameters) {
    bimData.EntityParameters = payload.EntityParameters;
  }
  if (payload.PointParameters) {
    bimData.PointParameters = payload.PointParameters;
  }
  return bimData;
}
function buildOtherTables(options) {
  const tables = [...OTHER_TABLES_BASE];
  if (options?.loadParameters) {
    tables.push(...PARAMETER_TABLES);
  }
  return tables;
}
function mergePayloads(payloads) {
  return payloads.reduce((acc, payload) => {
    Object.assign(acc, payload);
    return acc;
  }, {});
}
function pickFiles(files, tables) {
  const selected = {};
  for (const tableName of tables) {
    const buffer = files[tableName];
    if (!buffer) {
      throw new Error(`Missing extracted parquet buffer for "${tableName}".`);
    }
    selected[tableName] = buffer;
  }
  return selected;
}
function buildAllRequestedTables(options) {
  return [...VERTEX_TABLES, ...INDEX_TABLES, ...buildOtherTables(options)];
}
function findFileEndingWith(zip, suffix) {
  const lowerSuffix = suffix.toLowerCase();
  const name = Object.keys(zip.files).find(
    (entryName) => entryName.toLowerCase().endsWith(lowerSuffix)
  );
  if (!name) {
    throw new Error(`Could not find "${suffix}" in zip archive.`);
  }
  return name;
}
async function readParquetTableFromZip(zip, tableName, target, ctor, optional = false) {
  let entryName;
  try {
    entryName = findFileEndingWith(zip, tableName + ".parquet");
  } catch (error) {
    if (optional)
      return;
    throw error;
  }
  if (!entryName) {
    if (optional)
      return;
    throw new Error(`Could not find "${tableName}.parquet" in zip archive.`);
  }
  const zipTimer = `Getting zip table ${entryName}`;
  console.time(zipTimer);
  const file = await zip.files[entryName].async("arraybuffer");
  console.timeEnd(zipTimer);
  const parquetTimer = `Getting parquet data ${entryName}`;
  console.time(parquetTimer);
  const metadata = await parquetMetadataAsync(file);
  if (Number(metadata.num_rows) === 0) {
    for (const schemaElement of metadata.schema) {
      if (schemaElement.name && schemaElement.type !== void 0) {
        target[schemaElement.name] = ctor ? new ctor(0) : [];
      }
    }
    console.timeEnd(parquetTimer);
    return;
  }
  await parquetRead({
    file,
    compressors,
    metadata,
    onChunk(chunk) {
      let data = chunk.columnData;
      const firstValue = data?.length ? data[0] : void 0;
      const isBigIntArray = typeof firstValue === "bigint";
      if (ctor && data && data.constructor.name !== ctor.name && !isBigIntArray) {
        data = new ctor(data);
      }
      target[chunk.columnName] = data;
    }
  });
  console.timeEnd(parquetTimer);
}
async function loadBimDataFromZipMainThread(zip, options) {
  const bd = new BimData();
  const bg = {};
  await readParquetTableFromZip(zip, "Instances", bg, Int32Array);
  await readParquetTableFromZip(zip, "VertexBuffer", bg, Int32Array);
  await readParquetTableFromZip(zip, "IndexBuffer", bg, Uint32Array);
  await readParquetTableFromZip(zip, "Meshes", bg, Int32Array);
  await readParquetTableFromZip(zip, "Materials", bg, Uint8Array);
  await readParquetTableFromZip(zip, "Transforms", bg, Float32Array);
  bd.BimGeometry = bg;
  const entities = {};
  await readParquetTableFromZip(zip, "Entities", entities, Int32Array, true);
  if (Object.keys(entities).length > 0) {
    bd.Entities = entities;
  }
  const stringsTable = {};
  await readParquetTableFromZip(zip, "Strings", stringsTable, null, true);
  const stringsValue = stringsTable.Strings;
  if (Array.isArray(stringsValue)) {
    bd.Strings = stringsValue;
  }
  if (options?.loadParameters) {
    const descriptors = {};
    await readParquetTableFromZip(zip, "Descriptors", descriptors, Int32Array);
    bd.Descriptors = descriptors;
    const integerParameters = {};
    await readParquetTableFromZip(zip, "IntegerParameters", integerParameters, Int32Array);
    bd.IntegerParameters = integerParameters;
    const singleParameters = {};
    await readParquetTableFromZip(zip, "SingleParameters", singleParameters, Int32Array);
    bd.SingleParameters = singleParameters;
    const stringParameters = {};
    await readParquetTableFromZip(zip, "StringParameters", stringParameters, Int32Array);
    bd.StringParameters = stringParameters;
    const entityParameters = {};
    await readParquetTableFromZip(zip, "EntityParameters", entityParameters, Int32Array);
    bd.EntityParameters = entityParameters;
    const pointParameters = {};
    await readParquetTableFromZip(zip, "PointParameters", pointParameters, Int32Array);
    bd.PointParameters = pointParameters;
  }
  return bd;
}
async function loadBimDataFromSourceMainThread(source, options) {
  const response = await fetch(source);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch BOS from ${source}: ${response.status} ${response.statusText}`
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  return loadBimDataFromZipMainThread(zip, options);
}
async function finalizeBimData(bimData, options) {
  const instanceBuildMode = options?.instanceBuildMode ?? (options?.decodeMode === "workers" ? "worker" : "sync");
  bimData.Instances = instanceBuildMode === "worker" ? await buildInstancesAsyncConsumeGeometry(bimData.BimGeometry, "worker") : buildInstances(bimData.BimGeometry);
  bimData.Query = new BimQuery(bimData);
  bimData.Resolver = bimData.Query.Resolver;
  if (options?.renderMode === "view-state") {
    bimData.ThreeGeometry = bimData.buildViewStateGeometry(bimData.Instances);
    return bimData;
  }
  bimData.ThreeGeometry = await bimData.rebuildGeometryAsync(bimData.Instances);
  return bimData;
}
class BimOpenSchemaLoader {
  async load(source, options) {
    const totalTimer = `[BOS loader] total geometry load ${source}`;
    console.time(totalTimer);
    try {
      if (options?.decodeMode === "main-thread") {
        const mainThreadData = await loadBimDataFromSourceMainThread(source, options);
        return await finalizeBimData(mainThreadData, options);
      }
      const clients = getWorkerClients();
      const extractedFiles = await getZipWorkerClient().extract(
        source,
        buildAllRequestedTables(options)
      );
      const vertexFiles = pickFiles(extractedFiles, VERTEX_TABLES);
      const indexFiles = pickFiles(extractedFiles, INDEX_TABLES);
      const otherTables = buildOtherTables(options);
      const otherFiles = pickFiles(extractedFiles, otherTables);
      const [vertexPayload, indexPayload, othersPayload] = await Promise.all([
        clients.vertex.decode(vertexFiles),
        clients.index.decode(indexFiles),
        clients.others.decode(otherFiles)
      ]);
      const payload = mergePayloads([vertexPayload, indexPayload, othersPayload]);
      return await finalizeBimData(materializeBimData(payload), options);
    } finally {
      console.timeEnd(totalTimer);
    }
  }
}
async function loadBimGeometryFromZip(zip, options) {
  return loadBimDataFromZipMainThread(zip, options);
}
function __setWorkerClientsForTests(clients) {
  workerClientsOverride = clients;
}
function __setZipWorkerClientForTests(client) {
  zipWorkerClientOverride = client;
}
function disposeBimOpenSchemaWorkers() {
  if (workerClients) {
    workerClients.vertex.dispose?.();
    workerClients.index.dispose?.();
    workerClients.others.dispose?.();
    workerClients = null;
  }
  if (zipWorkerClient) {
    zipWorkerClient.dispose?.();
    zipWorkerClient = null;
  }
}
export {
  BimOpenSchemaLoader as B,
  ViewStateFlag as V,
  __setWorkerClientsForTests as _,
  __setZipWorkerClientForTests as a,
  buildViewStateTextures as b,
  ViewStateTable as c,
  disposeBimOpenSchemaWorkers as d,
  createViewStateMaterial as e,
  loadBimGeometryFromZip as l,
  setViewStateMaterialSelectionColor as s
};
//# sourceMappingURL=bimOpenSchemaLoader.cde4167e.js.map
