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
    __setWorkerClientsForTests
} from './bimOpenSchemaLoader';

describe('BimOpenSchemaLoader worker pipeline', () => {
    afterEach(() => {
        __setWorkerClientsForTests(null);
    });

    it('uses worker payload when worker succeeds', async () => {
        const vertexLoad = vi.fn(async () => ({
            VertexBuffer: {}
        }));
        const indexLoad = vi.fn(async () => ({
            IndexBuffer: {}
        }));
        const otherLoad = vi.fn(async () => ({
            Instances: {},
            Meshes: {},
            Materials: {},
            Transforms: {}
        }));
        __setWorkerClientsForTests({
            vertex: { load: vertexLoad },
            index: { load: indexLoad },
            others: { load: otherLoad }
        });

        const loader = new BimOpenSchemaLoader();
        const result = await loader.load('https://example.com/model.bos.zip', {
            loadParameters: false
        });

        expect(vertexLoad).toHaveBeenCalledTimes(1);
        expect(indexLoad).toHaveBeenCalledTimes(1);
        expect(otherLoad).toHaveBeenCalledTimes(1);
        expect(result).toBeInstanceOf(BimData);
        expect(result.BimGeometry).toBeDefined();
    });

    it('surfaces worker errors when worker fails', async () => {
        const vertexLoad = vi.fn(async () => ({
            VertexBuffer: {}
        }));
        const indexLoad = vi.fn(async () => ({
            IndexBuffer: {}
        }));
        const otherLoad = vi.fn(async () => {
            throw new Error('worker crashed');
        });
        __setWorkerClientsForTests({
            vertex: { load: vertexLoad },
            index: { load: indexLoad },
            others: { load: otherLoad }
        });

        const loader = new BimOpenSchemaLoader();
        await expect(
            loader.load('https://example.com/model.bos.zip', {
                loadParameters: true
            })
        ).rejects.toThrow('worker crashed');

        expect(vertexLoad).toHaveBeenCalledTimes(1);
        expect(indexLoad).toHaveBeenCalledTimes(1);
        expect(otherLoad).toHaveBeenCalledTimes(1);
    });
});
