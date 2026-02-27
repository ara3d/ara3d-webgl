import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { loadBimGeometryFromZip } from '../loader/bimOpenSchemaLoader';
import { buildInstances } from '../loader/buildInstances';
import { buildViewStateRuntime } from './viewStateRuntime';

const REALWORLD_BOS_PATH =
    '/Users/yskert/Documents/GitHub/vyssuals2/tests/assests/bos/geometry.bos.zip';

describe('ViewState runtime realworld timing', () => {
    it(
        'profiles load -> instances -> view-state runtime',
        async () => {
            const zipBuffer = await readFile(REALWORLD_BOS_PATH);
            const zip = await JSZip.loadAsync(zipBuffer);

            const tLoad0 = performance.now();
            const bimData = await loadBimGeometryFromZip(zip, { loadParameters: false });
            const tLoad1 = performance.now();

            const tInstances0 = performance.now();
            const instances = buildInstances(bimData.BimGeometry);
            const tInstances1 = performance.now();

            const tRuntime0 = performance.now();
            const runtime = buildViewStateRuntime(instances);
            const tRuntime1 = performance.now();

            const loadMs = tLoad1 - tLoad0;
            const instancesMs = tInstances1 - tInstances0;
            const runtimeMs = tRuntime1 - tRuntime0;
            const totalMs = loadMs + instancesMs + runtimeMs;

            // eslint-disable-next-line no-console
            console.log('[realworld-perf] geometry.bos.zip timings', {
                loadMs: Number(loadMs.toFixed(2)),
                instancesMs: Number(instancesMs.toFixed(2)),
                runtimeMs: Number(runtimeMs.toFixed(2)),
                totalMs: Number(totalMs.toFixed(2)),
                instanceCount: instances.length,
                bucketCount: runtime.model.group.children.length
            });

            expect(instances.length).toBeGreaterThan(0);
            expect(runtime.model.group.children.length).toBeGreaterThan(0);
        },
        180_000
    );
});
