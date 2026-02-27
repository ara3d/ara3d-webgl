import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import { Builder, ByteBuffer } from 'flatbuffers';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { BimGeometry } from '../loader/bimGeometry';

export type GeometryColumnName =
    | 'InstanceEntityIndex'
    | 'InstanceMaterialIndex'
    | 'InstanceMeshIndex'
    | 'InstanceTransformIndex'
    | 'InstanceFlags'
    | 'VertexX'
    | 'VertexY'
    | 'VertexZ'
    | 'IndexBuffer'
    | 'MeshVertexOffset'
    | 'MeshIndexOffset'
    | 'MaterialRed'
    | 'MaterialGreen'
    | 'MaterialBlue'
    | 'MaterialAlpha'
    | 'MaterialRoughness'
    | 'MaterialMetallic'
    | 'TransformTX'
    | 'TransformTY'
    | 'TransformTZ'
    | 'TransformQX'
    | 'TransformQY'
    | 'TransformQZ'
    | 'TransformQW'
    | 'TransformSX'
    | 'TransformSY'
    | 'TransformSZ';

export const GEOMETRY_COLUMNS: GeometryColumnName[] = [
    'InstanceEntityIndex',
    'InstanceMaterialIndex',
    'InstanceMeshIndex',
    'InstanceTransformIndex',
    'InstanceFlags',
    'VertexX',
    'VertexY',
    'VertexZ',
    'IndexBuffer',
    'MeshVertexOffset',
    'MeshIndexOffset',
    'MaterialRed',
    'MaterialGreen',
    'MaterialBlue',
    'MaterialAlpha',
    'MaterialRoughness',
    'MaterialMetallic',
    'TransformTX',
    'TransformTY',
    'TransformTZ',
    'TransformQX',
    'TransformQY',
    'TransformQZ',
    'TransformQW',
    'TransformSX',
    'TransformSY',
    'TransformSZ'
];

type TypedArray =
    | Int32Array
    | Uint32Array
    | Uint8Array
    | Float32Array;

type DType = 'i32' | 'u32' | 'u8' | 'f32';
type Codec = 'raw' | 'meshopt-vtx' | 'meshopt-idx';

type SegmentHeader = {
    name: GeometryColumnName;
    dtype: DType;
    length: number;
    codec: Codec;
    byteOffset: number;
    byteLength: number;
};

type EnvelopeHeader = {
    version: number;
    segments: SegmentHeader[];
};

const MAGIC = 'BOSV2M1';

function toBytes(array: TypedArray): Uint8Array {
    return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}

function concat(parts: Uint8Array[]): Uint8Array {
    const size = parts.reduce((acc, p) => acc + p.byteLength, 0);
    const out = new Uint8Array(size);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.byteLength;
    }
    return out;
}

function dtypeOf(array: TypedArray): DType {
    if (array instanceof Int32Array) return 'i32';
    if (array instanceof Uint32Array) return 'u32';
    if (array instanceof Uint8Array) return 'u8';
    return 'f32';
}

function ctorOf(dtype: DType): Int32ArrayConstructor | Uint32ArrayConstructor | Uint8ArrayConstructor | Float32ArrayConstructor {
    switch (dtype) {
        case 'i32':
            return Int32Array;
        case 'u32':
            return Uint32Array;
        case 'u8':
            return Uint8Array;
        case 'f32':
            return Float32Array;
    }
}

function needsMeshopt(column: GeometryColumnName): Codec {
    if (column === 'IndexBuffer') return 'meshopt-idx';
    if (column === 'VertexX' || column === 'VertexY' || column === 'VertexZ') return 'meshopt-vtx';
    return 'raw';
}

export function extractGeometryColumns(bg: BimGeometry): Record<GeometryColumnName, TypedArray> {
    const out = {} as Record<GeometryColumnName, TypedArray>;
    for (const name of GEOMETRY_COLUMNS) {
        out[name] = bg[name];
    }
    return out;
}

export async function encodeBosV2Meshopt(columns: Record<GeometryColumnName, TypedArray>): Promise<Uint8Array> {
    await MeshoptEncoder.ready;
    const segments: SegmentHeader[] = [];
    const payloadParts: Uint8Array[] = [];
    let runningOffset = 0;

    for (const name of GEOMETRY_COLUMNS) {
        const source = columns[name];
        const dtype = dtypeOf(source);
        const rawBytes = toBytes(source);
        const codec = needsMeshopt(name);
        let encoded: Uint8Array;

        if (codec === 'meshopt-vtx') {
            encoded = MeshoptEncoder.encodeVertexBuffer(rawBytes, source.length, source.BYTES_PER_ELEMENT);
        } else if (codec === 'meshopt-idx') {
            encoded = MeshoptEncoder.encodeIndexBuffer(rawBytes, source.length, source.BYTES_PER_ELEMENT);
        } else {
            encoded = rawBytes;
        }

        payloadParts.push(encoded);
        segments.push({
            name,
            dtype,
            length: source.length,
            codec,
            byteOffset: runningOffset,
            byteLength: encoded.byteLength
        });
        runningOffset += encoded.byteLength;
    }

    const payload = concat(payloadParts);
    const header: EnvelopeHeader = {
        version: 1,
        segments
    };
    const headerBytes = new TextEncoder().encode(JSON.stringify(header));
    const fixedHeader = new Uint8Array(12);
    fixedHeader.set(new TextEncoder().encode(MAGIC), 0);
    new DataView(fixedHeader.buffer).setUint32(8, headerBytes.byteLength, true);

    const envelope = concat([fixedHeader, headerBytes, payload]);
    return brotliCompressSync(envelope);
}

export async function decodeBosV2Meshopt(binary: Uint8Array): Promise<Record<GeometryColumnName, TypedArray>> {
    await MeshoptDecoder.ready;
    const decompressed = brotliDecompressSync(binary);
    const magic = new TextDecoder().decode(decompressed.subarray(0, 7));
    if (magic !== MAGIC) {
        throw new Error(`Invalid BOS-v2 magic: ${magic}`);
    }
    const headerLen = new DataView(
        decompressed.buffer,
        decompressed.byteOffset,
        decompressed.byteLength
    ).getUint32(8, true);
    const headerStart = 12;
    const headerEnd = headerStart + headerLen;
    const header = JSON.parse(
        new TextDecoder().decode(decompressed.subarray(headerStart, headerEnd))
    ) as EnvelopeHeader;
    const payload = decompressed.subarray(headerEnd);
    const out = {} as Record<GeometryColumnName, TypedArray>;

    for (const segment of header.segments) {
        const encoded = payload.subarray(
            segment.byteOffset,
            segment.byteOffset + segment.byteLength
        );
        const ctor = ctorOf(segment.dtype);
        const byteLength = segment.length * ctor.BYTES_PER_ELEMENT;
        const decodedBytes = new Uint8Array(byteLength);
        if (segment.codec === 'meshopt-vtx') {
            MeshoptDecoder.decodeVertexBuffer(
                decodedBytes,
                segment.length,
                ctor.BYTES_PER_ELEMENT,
                encoded
            );
        } else if (segment.codec === 'meshopt-idx') {
            MeshoptDecoder.decodeIndexBuffer(
                decodedBytes,
                segment.length,
                ctor.BYTES_PER_ELEMENT,
                encoded
            );
        } else {
            decodedBytes.set(encoded);
        }
        out[segment.name] = new ctor(decodedBytes.buffer, decodedBytes.byteOffset, segment.length);
    }
    return out;
}

export function encodeFlatBufferPack(columns: Record<GeometryColumnName, TypedArray>): Uint8Array {
    const segments: SegmentHeader[] = [];
    const payloadParts: Uint8Array[] = [];
    let runningOffset = 0;
    for (const name of GEOMETRY_COLUMNS) {
        const source = columns[name];
        const rawBytes = toBytes(source);
        payloadParts.push(rawBytes);
        segments.push({
            name,
            dtype: dtypeOf(source),
            length: source.length,
            codec: 'raw',
            byteOffset: runningOffset,
            byteLength: rawBytes.byteLength
        });
        runningOffset += rawBytes.byteLength;
    }
    const payload = brotliCompressSync(concat(payloadParts));
    const header: EnvelopeHeader = {
        version: 1,
        segments
    };

    const builder = new Builder(1024);
    const headerOffset = builder.createString(JSON.stringify(header));
    const payloadOffset = builder.createByteVector(payload);
    builder.startObject(2);
    builder.addFieldOffset(0, headerOffset, 0);
    builder.addFieldOffset(1, payloadOffset, 0);
    const root = builder.endObject();
    builder.finish(root);
    return builder.asUint8Array();
}

export function decodeFlatBufferPack(binary: Uint8Array): Record<GeometryColumnName, TypedArray> {
    const bb = new ByteBuffer(binary);
    const root = bb.readInt32(bb.position()) + bb.position();
    const headerField = bb.__offset(root, 4);
    const payloadField = bb.__offset(root, 6);
    if (!headerField || !payloadField) {
        throw new Error('Invalid FlatBuffer pack fields');
    }
    const headerText = bb.__string(root + headerField);
    const header = JSON.parse(headerText as string) as EnvelopeHeader;
    const payloadStart = bb.__vector(root + payloadField);
    const payloadLen = bb.__vector_len(root + payloadField);
    const compressedPayload = bb.bytes().subarray(payloadStart, payloadStart + payloadLen);
    const payload = brotliDecompressSync(compressedPayload);

    const out = {} as Record<GeometryColumnName, TypedArray>;
    for (const segment of header.segments) {
        const ctor = ctorOf(segment.dtype);
        const segmentBytes = payload.subarray(
            segment.byteOffset,
            segment.byteOffset + segment.byteLength
        );
        const copied = new Uint8Array(segmentBytes.byteLength);
        copied.set(segmentBytes);
        out[segment.name] = new ctor(copied.buffer, copied.byteOffset, segment.length);
    }
    return out;
}

export function toBimGeometry(columns: Record<GeometryColumnName, TypedArray>): BimGeometry {
    return columns as unknown as BimGeometry;
}
