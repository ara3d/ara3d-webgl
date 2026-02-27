import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { loadBimGeometryFromZip } from '../loader/bimOpenSchemaLoader';
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

const REALWORLD_BOS_PATH =
    '/Users/yskert/Documents/GitHub/vyssuals2/tests/assests/bos/geometry.bos.zip';

type BakeoffResult = {
    name: string;
    bytes: number;
    encodeMs: number;
    decodeMs: number;
    buildMs: number;
    totalDecodeBuildMs: number;
};

function printResults(baselineZipBytes: number, results: BakeoffResult[]): void {
    const bestDecodeBuild = Math.min(...results.map((r) => r.totalDecodeBuildMs));
    const table = results.map((r) => ({
        format: r.name,
        bytes: r.bytes,
        sizeVsZip: `${(r.bytes / baselineZipBytes).toFixed(3)}x`,
        encodeMs: Number(r.encodeMs.toFixed(2)),
        decodeMs: Number(r.decodeMs.toFixed(2)),
        buildMs: Number(r.buildMs.toFixed(2)),
        decodeBuildMs: Number(r.totalDecodeBuildMs.toFixed(2)),
        speedVsBest: `${(r.totalDecodeBuildMs / bestDecodeBuild).toFixed(2)}x`
    }));
    // eslint-disable-next-line no-console
    console.table(table);
}

function buildRuntimeMsFromGeometry(bg: ReturnType<typeof toBimGeometry>): number {
    const t0 = performance.now();
    const instances = buildInstances(bg);
    buildViewStateRuntime(instances);
    const t1 = performance.now();
    return t1 - t0;
}

describe('Geometry format bakeoff (offline)', () => {
    it(
        'converts and benchmarks BOS-v2+meshopt vs FlatBuffer pack',
        async () => {
            const startedAt = performance.now();
            const heartbeat = setInterval(() => {
                const elapsed = ((performance.now() - startedAt) / 1000).toFixed(1);
                // eslint-disable-next-line no-console
                console.log(`[bakeoff] still running... ${elapsed}s elapsed`);
            }, 5000);
            try {
                const artifactsDir = path.resolve(process.cwd(), '.tmp/perf-formats');
                await mkdir(artifactsDir, { recursive: true });
                // eslint-disable-next-line no-console
                console.log('[bakeoff] stage=load-baseline');
                const zipBytes = statSync(REALWORLD_BOS_PATH).size;
                const zipBuffer = await readFile(REALWORLD_BOS_PATH);
                await writeFile(path.join(artifactsDir, 'baseline.geometry.bos.zip'), zipBuffer);
                const zip = await JSZip.loadAsync(zipBuffer);
                const bimData = await loadBimGeometryFromZip(zip, { loadParameters: false });
                const columns = extractGeometryColumns(bimData.BimGeometry);

                // eslint-disable-next-line no-console
                console.log('[bakeoff] stage=build-baseline-runtime');
                const baselineBuildMs = buildRuntimeMsFromGeometry(bimData.BimGeometry);
                const baseline: BakeoffResult = {
                    name: 'baseline-bos-mainthread-parse',
                    bytes: zipBytes,
                    encodeMs: 0,
                    decodeMs: 0,
                    buildMs: baselineBuildMs,
                    totalDecodeBuildMs: baselineBuildMs
                };

                // eslint-disable-next-line no-console
                console.log('[bakeoff] stage=encode-bosv2');
                const tEncodeBosv2Start = performance.now();
                const bosv2Binary = await encodeBosV2Meshopt(columns);
                const tEncodeBosv2End = performance.now();
                const bosv2Path = path.join(artifactsDir, 'geometry.bosv2.meshopt.br');
                await writeFile(bosv2Path, bosv2Binary);
                // eslint-disable-next-line no-console
                console.log('[bakeoff] stage=decode-bosv2');
                const tDecodeBosv2Start = performance.now();
                const bosv2Columns = await decodeBosV2Meshopt(bosv2Binary);
                const tDecodeBosv2End = performance.now();
                // eslint-disable-next-line no-console
                console.log('[bakeoff] stage=build-bosv2-runtime');
                const bosv2BuildMs = buildRuntimeMsFromGeometry(toBimGeometry(bosv2Columns));
                const bosv2Result: BakeoffResult = {
                    name: 'bosv2-meshopt-brotli',
                    bytes: statSync(bosv2Path).size,
                    encodeMs: tEncodeBosv2End - tEncodeBosv2Start,
                    decodeMs: tDecodeBosv2End - tDecodeBosv2Start,
                    buildMs: bosv2BuildMs,
                    totalDecodeBuildMs: tDecodeBosv2End - tDecodeBosv2Start + bosv2BuildMs
                };

                // eslint-disable-next-line no-console
                console.log('[bakeoff] stage=encode-flatbuffer');
                const tEncodeFlatStart = performance.now();
                const flatBinary = encodeFlatBufferPack(columns);
                const tEncodeFlatEnd = performance.now();
                const flatPath = path.join(artifactsDir, 'geometry.flatbuf.br');
                await writeFile(flatPath, flatBinary);
                // eslint-disable-next-line no-console
                console.log('[bakeoff] stage=decode-flatbuffer');
                const tDecodeFlatStart = performance.now();
                const flatColumns = decodeFlatBufferPack(flatBinary);
                const tDecodeFlatEnd = performance.now();
                // eslint-disable-next-line no-console
                console.log('[bakeoff] stage=build-flatbuffer-runtime');
                const flatBuildMs = buildRuntimeMsFromGeometry(toBimGeometry(flatColumns));
                const flatResult: BakeoffResult = {
                    name: 'flatbuffer-pack-brotli',
                    bytes: statSync(flatPath).size,
                    encodeMs: tEncodeFlatEnd - tEncodeFlatStart,
                    decodeMs: tDecodeFlatEnd - tDecodeFlatStart,
                    buildMs: flatBuildMs,
                    totalDecodeBuildMs: tDecodeFlatEnd - tDecodeFlatStart + flatBuildMs
                };

                const results = [baseline, bosv2Result, flatResult];
                printResults(zipBytes, results);
                // eslint-disable-next-line no-console
                console.log('[format-artifacts]', {
                    artifactsDir,
                    baselineZipPath: path.join(artifactsDir, 'baseline.geometry.bos.zip'),
                    bosv2Path,
                    flatPath
                });

                expect(bosv2Binary.byteLength).toBeGreaterThan(0);
                expect(flatBinary.byteLength).toBeGreaterThan(0);
                expect(results.length).toBe(3);
            } finally {
                clearInterval(heartbeat);
            }
        },
        900_000
    );
});
