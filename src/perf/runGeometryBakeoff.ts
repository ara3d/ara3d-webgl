import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import JSZip from 'jszip';
import { ColumnData, parquetMetadataAsync, parquetRead } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { BimGeometry } from '../loader/bimGeometry';
import { buildInstances } from '../loader/buildInstances';
import { buildViewStateRuntime } from '../renderState/viewStateRuntime';
import {
    decodeBosV2Meshopt,
    decodeFlatBufferPack,
    encodeBosV2Meshopt,
    encodeFlatBufferPack,
    extractGeometryColumns,
    toBimGeometry
} from './geometryFormatConverters';

type TypedArrayCtor =
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Uint8ArrayConstructor
    | Float32ArrayConstructor;

type TableData = Record<string, unknown>;

const REALWORLD_BOS_PATH =
    '/Users/yskert/Documents/GitHub/vyssuals2/tests/assests/bos/geometry.bos.zip';

const GEOMETRY_TABLES: Array<{
    table: string;
    ctor: TypedArrayCtor | null;
}> = [
    { table: 'Instances', ctor: Int32Array },
    { table: 'VertexBuffer', ctor: Int32Array },
    { table: 'IndexBuffer', ctor: Uint32Array },
    { table: 'Meshes', ctor: Int32Array },
    { table: 'Materials', ctor: Uint8Array },
    { table: 'Transforms', ctor: Float32Array }
];

function nowMs(): number {
    return performance.now();
}

function maybeConvertColumn(
    data: ColumnData['columnData'],
    ctor: TypedArrayCtor | null
): ColumnData['columnData'] {
    if (!ctor || !data) return data;
    const firstValue = data.length ? (data as ArrayLike<unknown>)[0] : undefined;
    if (typeof firstValue === 'bigint') return data;
    if (data.constructor.name !== ctor.name) {
        return new ctor(data as ArrayLike<number>);
    }
    return data;
}

function findFileEndingWith(zip: JSZip, suffix: string): string {
    const lower = suffix.toLowerCase();
    const entry = Object.keys(zip.files).find((name) => name.toLowerCase().endsWith(lower));
    if (!entry) throw new Error(`Missing ${suffix} in zip`);
    return entry;
}

async function readParquetTableFromZip(
    zip: JSZip,
    tableName: string,
    target: TableData,
    ctor: TypedArrayCtor | null
): Promise<void> {
    const entryName = findFileEndingWith(zip, `${tableName}.parquet`);
    const file = await zip.files[entryName].async('arraybuffer');
    const metadata = await parquetMetadataAsync(file);
    if (Number(metadata.num_rows) === 0) return;
    await parquetRead({
        file,
        compressors,
        metadata,
        onChunk(chunk: ColumnData) {
            target[chunk.columnName] = maybeConvertColumn(chunk.columnData, ctor);
        }
    });
}

async function loadGeometryFromBosZip(zipPath: string): Promise<BimGeometry> {
    const zipBuffer = await readFile(zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);
    const bg: TableData = {};
    for (const item of GEOMETRY_TABLES) {
        await readParquetTableFromZip(zip, item.table, bg, item.ctor);
    }
    return bg as unknown as BimGeometry;
}

function buildRuntimeMsFromGeometry(bg: BimGeometry): number {
    const t0 = nowMs();
    const instances = buildInstances(bg);
    buildViewStateRuntime(instances);
    const t1 = nowMs();
    return t1 - t0;
}

async function run(): Promise<void> {
    const artifactsDir = path.resolve(process.cwd(), '.tmp/perf-formats');
    await mkdir(artifactsDir, { recursive: true });
    const baselineZipBytes = statSync(REALWORLD_BOS_PATH).size;

    const tLoad0 = nowMs();
    const bg = await loadGeometryFromBosZip(REALWORLD_BOS_PATH);
    const tLoad1 = nowMs();
    const columns = extractGeometryColumns(bg);
    const baselineBuildMs = buildRuntimeMsFromGeometry(bg);

    const tEncodeBosv2Start = nowMs();
    const bosv2Binary = await encodeBosV2Meshopt(columns);
    const tEncodeBosv2End = nowMs();
    const bosv2Path = path.join(artifactsDir, 'geometry.bosv2.meshopt.br');
    await writeFile(bosv2Path, bosv2Binary);
    const tDecodeBosv2Start = nowMs();
    const bosv2Columns = await decodeBosV2Meshopt(bosv2Binary);
    const tDecodeBosv2End = nowMs();
    const bosv2BuildMs = buildRuntimeMsFromGeometry(toBimGeometry(bosv2Columns));

    const tEncodeFlatStart = nowMs();
    const flatBinary = encodeFlatBufferPack(columns);
    const tEncodeFlatEnd = nowMs();
    const flatPath = path.join(artifactsDir, 'geometry.flatbuf.br');
    await writeFile(flatPath, flatBinary);
    const tDecodeFlatStart = nowMs();
    const flatColumns = decodeFlatBufferPack(flatBinary);
    const tDecodeFlatEnd = nowMs();
    const flatBuildMs = buildRuntimeMsFromGeometry(toBimGeometry(flatColumns));

    const rows = [
        {
            format: 'baseline.bos.zip',
            bytes: baselineZipBytes,
            sizeVsBaseline: '1.000x',
            loadOrEncodeMs: Number((tLoad1 - tLoad0).toFixed(2)),
            decodeMs: 0,
            buildMs: Number(baselineBuildMs.toFixed(2)),
            decodeBuildMs: Number(baselineBuildMs.toFixed(2))
        },
        {
            format: 'bosv2.meshopt.br',
            bytes: statSync(bosv2Path).size,
            sizeVsBaseline: `${(statSync(bosv2Path).size / baselineZipBytes).toFixed(3)}x`,
            loadOrEncodeMs: Number((tEncodeBosv2End - tEncodeBosv2Start).toFixed(2)),
            decodeMs: Number((tDecodeBosv2End - tDecodeBosv2Start).toFixed(2)),
            buildMs: Number(bosv2BuildMs.toFixed(2)),
            decodeBuildMs: Number((tDecodeBosv2End - tDecodeBosv2Start + bosv2BuildMs).toFixed(2))
        },
        {
            format: 'flatbuf.pack.br',
            bytes: statSync(flatPath).size,
            sizeVsBaseline: `${(statSync(flatPath).size / baselineZipBytes).toFixed(3)}x`,
            loadOrEncodeMs: Number((tEncodeFlatEnd - tEncodeFlatStart).toFixed(2)),
            decodeMs: Number((tDecodeFlatEnd - tDecodeFlatStart).toFixed(2)),
            buildMs: Number(flatBuildMs.toFixed(2)),
            decodeBuildMs: Number((tDecodeFlatEnd - tDecodeFlatStart + flatBuildMs).toFixed(2))
        }
    ];

    // eslint-disable-next-line no-console
    console.table(rows);
    // eslint-disable-next-line no-console
    console.log({
        artifactsDir,
        files: {
            baseline: REALWORLD_BOS_PATH,
            bosv2: bosv2Path,
            flatbuf: flatPath
        }
    });
}

run().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[runGeometryBakeoff] failed', error);
    process.exitCode = 1;
});
