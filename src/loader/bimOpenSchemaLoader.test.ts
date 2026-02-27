import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./buildInstances', () => ({
    buildInstances: vi.fn(() => [])
}));

vi.mock('./buildGeometryGroup', () => ({
    buildGeometry: vi.fn(() => ({ children: [] }))
}));

vi.mock('./bimQuery', () => ({
    BimQuery: class {
        Resolver = {};
    }
}));

import { BimData } from './bimData';
import {
    BimOpenSchemaLoader,
    __setWorkerClientForTests
} from './bimOpenSchemaLoader';

describe('BimOpenSchemaLoader worker pipeline', () => {
    afterEach(() => {
        __setWorkerClientForTests(null);
    });

    it('uses worker payload when worker succeeds', async () => {
        const workerLoad = vi.fn(async () => ({
            geometry: {}
        }));
        __setWorkerClientForTests({ load: workerLoad });

        const loader = new BimOpenSchemaLoader();
        const result = await loader.load('https://example.com/model.bos.zip', {
            loadParameters: false
        });

        expect(workerLoad).toHaveBeenCalledTimes(1);
        expect(result).toBeInstanceOf(BimData);
        expect(result.BimGeometry).toBeDefined();
    });

    it('surfaces worker errors when worker fails', async () => {
        const workerLoad = vi.fn(async () => {
            throw new Error('worker crashed');
        });
        __setWorkerClientForTests({ load: workerLoad });

        const loader = new BimOpenSchemaLoader();
        await expect(
            loader.load('https://example.com/model.bos.zip', {
                loadParameters: true
            })
        ).rejects.toThrow('worker crashed');

        expect(workerLoad).toHaveBeenCalledTimes(1);
    });
});
