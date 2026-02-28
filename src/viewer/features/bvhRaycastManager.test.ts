import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { BvhRaycastManager } from './bvhRaycastManager';

function createIndexedMesh(offsetX: number): THREE.Mesh {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(
            new Float32Array([
                offsetX + 0, 0, 0,
                offsetX + 1, 0, 0,
                offsetX + 0, 1, 0
            ]),
            3
        )
    );
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array([0, 1, 2]), 1));
    return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
}

describe('BvhRaycastManager', () => {
    it('queues precompute tasks only for meshes accepted by shouldPrecomputeMesh', () => {
        const manager = new BvhRaycastManager();
        const fakeWorker = { postMessage: vi.fn() };
        (manager as any).ensureBvhPrecomputeWorker = () => fakeWorker;

        const group = new THREE.Group();
        const meshA = createIndexedMesh(0);
        const meshB = createIndexedMesh(10);
        group.add(meshA);
        group.add(meshB);

        manager.queuePrecomputeForGroup(group, {
            shouldPrecomputeMesh: (mesh) => mesh === meshA
        });

        expect(fakeWorker.postMessage).toHaveBeenCalledTimes(1);
        const snapshot = manager.getPrecomputeSnapshot();
        expect(snapshot.queued).toBe(1);
        expect(snapshot.pendingTasks).toBe(1);
        expect(snapshot.pendingGeometries).toBe(1);
        expect(snapshot.cacheSize).toBe(0);
    });

    it('clears boundsTree when clearing cached BVHs', () => {
        const manager = new BvhRaycastManager();
        const mesh = createIndexedMesh(0);
        const geometry = mesh.geometry as THREE.BufferGeometry & { boundsTree?: unknown };

        manager.getOrCreateBVH(geometry);
        expect(geometry.boundsTree).toBeTruthy();

        manager.clearCache();
        expect(geometry.boundsTree).toBeUndefined();
        expect(manager.getPrecomputeSnapshot().cacheSize).toBe(0);
    });
});
