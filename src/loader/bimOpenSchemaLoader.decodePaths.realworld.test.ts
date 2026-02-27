import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { parquetMetadataAsync, parquetRead, ColumnData } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { loadBimGeometryFromZip } from './bimOpenSchemaLoader';
import { BimGeometry } from './bimGeometry';
import { buildInstances, buildInstancesAsync } from './buildInstances';
import { buildViewStateRuntime } from '../renderState/viewStateRuntime';

const REALWORLD_BOS_PATH =
    '/Users/yskert/Documents/GitHub/vyssuals2/tests/assests/bos/geometry.bos.zip';

type TableData = Record<string, unknown>;
type TypedArrayCtor =
    | Int32ArrayConstructor
    | Uint32ArrayConstructor
    | Uint8ArrayConstructor
    | Float32ArrayConstructor;

const TABLE_CONFIG = new Map<string, TypedArrayCtor | null>([
    ['Instances', Int32Array],
    ['VertexBuffer', Int32Array],
    ['IndexBuffer', Uint32Array],
    ['Meshes', Int32Array],
    ['Materials', Uint8Array],
    ['Transforms', Float32Array],
    ['Entities', Int32Array],
    ['Strings', null]
]);

const VERTEX_TABLES = ['VertexBuffer'];
const INDEX_TABLES = ['IndexBuffer'];
const OTHER_TABLES = ['Instances', 'Meshes', 'Materials', 'Transforms', 'Entities', 'Strings'];

function findFileEndingWith(zip: JSZip, suffix: string): string {
    const lowerSuffix = suffix.toLowerCase();
    const name = Object.keys(zip.files).find((entryName) =>
        entryName.toLowerCase().endsWith(lowerSuffix)
    );
    if (!name) throw new Error(`Could not find "${suffix}" in zip archive.`);
    return name;
}

async function extractParquetBuffers(
    zip: JSZip,
    tables: string[]
): Promise<Record<string, ArrayBuffer>> {
    const entries = await Promise.all(
        tables.map(async (tableName) => {
            const entryName = findFileEndingWith(zip, `${tableName}.parquet`);
            const file = await zip.files[entryName].async('arraybuffer');
            return [tableName, file] as const;
        })
    );
    return Object.fromEntries(entries);
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

async function decodeTableBuffer(
    tableName: string,
    file: ArrayBuffer
): Promise<TableData> {
    const ctor = TABLE_CONFIG.get(tableName);
    if (ctor === undefined) throw new Error(`Unknown table ${tableName}`);
    const metadata = await parquetMetadataAsync(file);
    const table: TableData = {};
    if (Number(metadata.num_rows) === 0) return table;
    await parquetRead({
        file,
        compressors,
        metadata,
        onChunk(chunk: ColumnData) {
            table[chunk.columnName] = maybeConvertColumn(chunk.columnData, ctor);
        }
    });
    return table;
}

async function decodeSplitParallel(zip: JSZip): Promise<BimGeometry> {
    const allTables = [...VERTEX_TABLES, ...INDEX_TABLES, ...OTHER_TABLES];
    const buffers = await extractParquetBuffers(zip, allTables);

    const [vertexPayload, indexPayload, othersPayload] = await Promise.all([
        Promise.all(VERTEX_TABLES.map((t) => decodeTableBuffer(t, buffers[t]))),
        Promise.all(INDEX_TABLES.map((t) => decodeTableBuffer(t, buffers[t]))),
        Promise.all(OTHER_TABLES.map((t) => decodeTableBuffer(t, buffers[t])))
    ]);

    const merged = {} as TableData;
    for (const payload of [...vertexPayload, ...indexPayload, ...othersPayload]) {
        Object.assign(merged, payload);
    }
    return merged as BimGeometry;
}

function runtimeBuildMs(bg: BimGeometry): { instancesMs: number; runtimeMs: number; totalMs: number } {
    const tInstances0 = performance.now();
    const instances = buildInstances(bg);
    const tInstances1 = performance.now();
    const tRuntime0 = performance.now();
    buildViewStateRuntime(instances);
    const tRuntime1 = performance.now();
    const instancesMs = tInstances1 - tInstances0;
    const runtimeMs = tRuntime1 - tRuntime0;
    return {
        instancesMs,
        runtimeMs,
        totalMs: instancesMs + runtimeMs
    };
}

describe('BOS decode paths realworld timing', () => {
    it(
        'compares sequential main-thread decode vs split-parallel decode',
        async () => {
            const zipBuffer = await readFile(REALWORLD_BOS_PATH);
            const zip = await JSZip.loadAsync(zipBuffer);

            const tSeq0 = performance.now();
            const seqData = await loadBimGeometryFromZip(zip, {
                loadParameters: false,
                decodeMode: 'main-thread',
                renderMode: 'view-state'
            });
            const tSeq1 = performance.now();
            const seqBuild = runtimeBuildMs(seqData.BimGeometry);

            const tPar0 = performance.now();
            const parallelGeometry = await decodeSplitParallel(zip);
            const tPar1 = performance.now();
            const parBuild = runtimeBuildMs(parallelGeometry);

            // eslint-disable-next-line no-console
            console.log('[decode-paths-perf]', {
                sequential: {
                    decodeMs: Number((tSeq1 - tSeq0).toFixed(2)),
                    instancesMs: Number(seqBuild.instancesMs.toFixed(2)),
                    runtimeMs: Number(seqBuild.runtimeMs.toFixed(2)),
                    totalMs: Number((tSeq1 - tSeq0 + seqBuild.totalMs).toFixed(2))
                },
                splitParallel: {
                    decodeMs: Number((tPar1 - tPar0).toFixed(2)),
                    instancesMs: Number(parBuild.instancesMs.toFixed(2)),
                    runtimeMs: Number(parBuild.runtimeMs.toFixed(2)),
                    totalMs: Number((tPar1 - tPar0 + parBuild.totalMs).toFixed(2))
                }
            });

            expect(seqBuild.totalMs).toBeGreaterThan(0);
            expect(parBuild.totalMs).toBeGreaterThan(0);
        },
        240_000
    );
});

describe('Instance build mode realworld timing', () => {
    it(
        'compares sync vs worker instance building on same geometry',
        async () => {
            if (typeof Worker === 'undefined') {
                // eslint-disable-next-line no-console
                console.log('[instance-build-perf] skipped (Worker unavailable in node environment)');
                return;
            }
            const zipBuffer = await readFile(REALWORLD_BOS_PATH);
            const zip = await JSZip.loadAsync(zipBuffer);
            const data = await loadBimGeometryFromZip(zip, {
                loadParameters: false,
                decodeMode: 'main-thread',
                renderMode: 'view-state'
            });

            const tSync0 = performance.now();
            const syncInstances = buildInstances(data.BimGeometry);
            const tSync1 = performance.now();

            const tWorker0 = performance.now();
            const workerInstances = await buildInstancesAsync(data.BimGeometry, 'worker');
            const tWorker1 = performance.now();

            // eslint-disable-next-line no-console
            console.log('[instance-build-perf]', {
                syncMs: Number((tSync1 - tSync0).toFixed(2)),
                workerMs: Number((tWorker1 - tWorker0).toFixed(2)),
                speedup: Number(((tSync1 - tSync0) / (tWorker1 - tWorker0)).toFixed(3)),
                syncCount: syncInstances.length,
                workerCount: workerInstances.length
            });

            expect(syncInstances.length).toBe(workerInstances.length);
        },
        240_000
    );
});

