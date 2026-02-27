import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./buildInstances', () => ({
    buildInstances: vi.fn(() => [])
}));

vi.mock('./buildGeometryGroup', () => ({
    buildGeometry: vi.fn(() => ({ children: [] })),
    buildGeometryAsync: vi.fn(async () => ({ children: [] }))
}));

vi.mock('./bimQuery', () => ({
    BimQuery: class {
        Resolver = {};
    }
}));

import { BimData } from './bimData';
import {
    BimOpenSchemaLoader,
    __setWorkerClientsForTests,
    __setZipWorkerClientForTests
} from './bimOpenSchemaLoader';

describe('BimOpenSchemaLoader worker pipeline', () => {
    afterEach(() => {
        __setWorkerClientsForTests(null);
        __setZipWorkerClientForTests(null);
    });

    it('uses worker payload when worker succeeds', async () => {
        const extract = vi.fn(async () => ({
            VertexBuffer: new ArrayBuffer(1),
            IndexBuffer: new ArrayBuffer(1),
            Instances: new ArrayBuffer(1),
            Meshes: new ArrayBuffer(1),
            Materials: new ArrayBuffer(1),
            Transforms: new ArrayBuffer(1),
            Entities: new ArrayBuffer(1),
            Strings: new ArrayBuffer(1)
        }));
        const vertexDecode = vi.fn(async () => ({
            VertexBuffer: {}
        }));
        const indexDecode = vi.fn(async () => ({
            IndexBuffer: {}
        }));
        const otherDecode = vi.fn(async () => ({
            Instances: {},
            Meshes: {},
            Materials: {},
            Transforms: {}
        }));
        __setZipWorkerClientForTests({ extract });
        __setWorkerClientsForTests({
            vertex: { decode: vertexDecode },
            index: { decode: indexDecode },
            others: { decode: otherDecode }
        });

        const loader = new BimOpenSchemaLoader();
        const result = await loader.load('https://example.com/model.bos.zip', {
            loadParameters: false
        });

        expect(extract).toHaveBeenCalledTimes(1);
        expect(vertexDecode).toHaveBeenCalledTimes(1);
        expect(indexDecode).toHaveBeenCalledTimes(1);
        expect(otherDecode).toHaveBeenCalledTimes(1);
        expect(result).toBeInstanceOf(BimData);
        expect(result.BimGeometry).toBeDefined();
    });

    it('surfaces worker errors when worker fails', async () => {
        const extract = vi.fn(async () => ({
            VertexBuffer: new ArrayBuffer(1),
            IndexBuffer: new ArrayBuffer(1),
            Instances: new ArrayBuffer(1),
            Meshes: new ArrayBuffer(1),
            Materials: new ArrayBuffer(1),
            Transforms: new ArrayBuffer(1),
            Entities: new ArrayBuffer(1),
            Strings: new ArrayBuffer(1),
            Descriptors: new ArrayBuffer(1),
            IntegerParameters: new ArrayBuffer(1),
            SingleParameters: new ArrayBuffer(1),
            StringParameters: new ArrayBuffer(1),
            EntityParameters: new ArrayBuffer(1),
            PointParameters: new ArrayBuffer(1)
        }));
        const vertexDecode = vi.fn(async () => ({
            VertexBuffer: {}
        }));
        const indexDecode = vi.fn(async () => ({
            IndexBuffer: {}
        }));
        const otherDecode = vi.fn(async () => {
            throw new Error('worker crashed');
        });
        __setZipWorkerClientForTests({ extract });
        __setWorkerClientsForTests({
            vertex: { decode: vertexDecode },
            index: { decode: indexDecode },
            others: { decode: otherDecode }
        });

        const loader = new BimOpenSchemaLoader();
        await expect(
            loader.load('https://example.com/model.bos.zip', {
                loadParameters: true
            })
        ).rejects.toThrow('worker crashed');

        expect(extract).toHaveBeenCalledTimes(1);
        expect(vertexDecode).toHaveBeenCalledTimes(1);
        expect(indexDecode).toHaveBeenCalledTimes(1);
        expect(otherDecode).toHaveBeenCalledTimes(1);
    });
});
