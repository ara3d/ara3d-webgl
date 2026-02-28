/// <reference lib="webworker" />

import * as THREE from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type {
    BvhPrecomputeMainToWorkerMessage,
    BvhPrecomputeWorkerToMainMessage
} from './bvhPrecomputeWorkerTypes';

const post = (message: BvhPrecomputeWorkerToMainMessage): void => {
    (self as unknown as Worker).postMessage(message);
};

const buildSerializedBvh = (message: BvhPrecomputeMainToWorkerMessage): void => {
    if (message.type !== 'build') return;

    const geometry = new THREE.BufferGeometry();
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
        geometry.setAttribute('position', new THREE.BufferAttribute(message.position, 3));
        geometry.setIndex(new THREE.BufferAttribute(message.index, 1));

        const bvh = new MeshBVH(geometry, { maxLeafSize: 10, indirect: true });
        const serialized = MeshBVH.serialize(bvh);

        post({
            type: 'built',
            taskId: message.taskId,
            generation: message.generation,
            serialized,
            buildDurationMs: (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt
        });
    } catch (error) {
        const err = error as Error;
        post({
            type: 'error',
            taskId: message.taskId,
            generation: message.generation,
            message: err?.message ?? 'BVH precompute failed',
            stack: err?.stack
        });
    } finally {
        geometry.dispose();
    }
};

self.onmessage = (event: MessageEvent<BvhPrecomputeMainToWorkerMessage>) => {
    buildSerializedBvh(event.data);
};
