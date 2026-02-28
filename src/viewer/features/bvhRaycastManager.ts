import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
import BvhPrecomputeWorker from './workers/bvhPrecompute.worker?worker&inline';
import type {
    BvhIndexArray,
    BvhPrecomputeMainToWorkerMessage,
    BvhPrecomputeWorkerToMainMessage
} from './workers/bvhPrecomputeWorkerTypes';

type PendingBvhTask = {
    generation: number;
    geometry: THREE.BufferGeometry;
};

type BvhPrecomputeStats = {
    generation: number;
    startedAtMs: number;
    queued: number;
    completed: number;
    failed: number;
    workerBuildTotalMs: number;
    workerBuildMaxMs: number;
};

export type BvhLogPayload = {
    generation: number;
    queued: number;
    completed: number;
    failed: number;
    elapsedMs?: number;
    workerBuildTotalMs?: number;
    workerBuildMaxMs?: number;
};

export type BvhRaycastManagerOptions = {
    onLog?: (stage: string, payload: BvhLogPayload) => void;
    nowMs?: () => number;
};

export type BvhQueuePrecomputeOptions = {
    shouldPrecomputeMesh?: (mesh: THREE.Mesh) => boolean;
};

export type BvhPrecomputeSnapshot = BvhLogPayload & {
    pendingTasks: number;
    pendingGeometries: number;
    cacheSize: number;
};

export class BvhRaycastManager {
    private static raycastPatched = false;
    private static originalMeshRaycast:
        | ((this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) => void)
        | null = null;

    private readonly bvhCache = new Map<THREE.BufferGeometry, MeshBVH>();
    private bvhPrecomputeWorker: Worker | null = null;
    private bvhPrecomputeGeneration = 0;
    private nextBvhPrecomputeTaskId = 1;
    private readonly pendingBvhTasks = new Map<number, PendingBvhTask>();
    private readonly pendingBvhGeometries = new Set<THREE.BufferGeometry>();
    private bvhPrecomputeStats: BvhPrecomputeStats = {
        generation: 0,
        startedAtMs: 0,
        queued: 0,
        completed: 0,
        failed: 0,
        workerBuildTotalMs: 0,
        workerBuildMaxMs: 0
    };
    private readonly onLog?: (stage: string, payload: BvhLogPayload) => void;
    private readonly nowMs: () => number;

    constructor(options?: BvhRaycastManagerOptions) {
        this.onLog = options?.onLog;
        this.nowMs = options?.nowMs ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    }

    ensureRaycastAcceleration(): void {
        if (BvhRaycastManager.raycastPatched) return;

        const meshPrototype = (THREE.Mesh as any).prototype;
        const fallbackRaycast = meshPrototype.raycast as (
            this: THREE.Mesh,
            raycaster: THREE.Raycaster,
            intersects: THREE.Intersection[]
        ) => void;
        BvhRaycastManager.originalMeshRaycast = fallbackRaycast;

        meshPrototype.raycast = function (
            this: THREE.Mesh,
            raycaster: THREE.Raycaster,
            intersects: THREE.Intersection[]
        ): void {
            const geometry = this.geometry as
                | (THREE.BufferGeometry & { boundsTree?: MeshBVH })
                | undefined;
            if (geometry?.boundsTree) {
                acceleratedRaycast.call(this as any, raycaster as any, intersects as any);
                return;
            }
            if (!BvhRaycastManager.originalMeshRaycast) return;
            BvhRaycastManager.originalMeshRaycast.call(this, raycaster, intersects);
        };

        BvhRaycastManager.raycastPatched = true;
    }

    getOrCreateBVH(geometry: THREE.BufferGeometry): MeshBVH {
        let bvh = this.bvhCache.get(geometry);
        if (!bvh) {
            bvh = new MeshBVH(geometry, { maxLeafSize: 10, indirect: true });
            this.bvhCache.set(geometry, bvh);
            (geometry as any).boundsTree = bvh;
        }
        return bvh;
    }

    clearCache(): void {
        for (const geometry of this.bvhCache.keys()) {
            if ((geometry as any).boundsTree) {
                delete (geometry as any).boundsTree;
            }
        }
        this.bvhCache.clear();
    }

    clearGeometryBVH(geometry: THREE.BufferGeometry): void {
        if ((geometry as any).boundsTree) {
            delete (geometry as any).boundsTree;
        }
        this.bvhCache.delete(geometry);
        this.pendingBvhGeometries.delete(geometry);
    }

    resetPrecomputeQueue(): void {
        this.bvhPrecomputeGeneration += 1;
        this.pendingBvhTasks.clear();
        this.pendingBvhGeometries.clear();
        this.bvhPrecomputeStats = {
            generation: this.bvhPrecomputeGeneration,
            startedAtMs: 0,
            queued: 0,
            completed: 0,
            failed: 0,
            workerBuildTotalMs: 0,
            workerBuildMaxMs: 0
        };
    }

    queuePrecomputeForGroup(group: THREE.Object3D | null, options?: BvhQueuePrecomputeOptions): void {
        if (!group) return;

        const worker = this.ensureBvhPrecomputeWorker();
        if (!worker) return;

        const generation = this.bvhPrecomputeGeneration;
        this.bvhPrecomputeStats = {
            generation,
            startedAtMs: this.nowMs(),
            queued: 0,
            completed: 0,
            failed: 0,
            workerBuildTotalMs: 0,
            workerBuildMaxMs: 0
        };

        group.traverse((child: THREE.Object3D) => {
            const mesh = child as THREE.Mesh;
            if (!mesh.isMesh || !mesh.geometry) return;
            if (options?.shouldPrecomputeMesh && !options.shouldPrecomputeMesh(mesh)) return;

            const geometry = mesh.geometry as THREE.BufferGeometry;
            const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
            const indexAttribute = geometry.getIndex();
            if (!positionAttribute || !indexAttribute) return;
            if (positionAttribute.itemSize !== 3) return;

            if (
                (geometry as any).boundsTree ||
                this.bvhCache.has(geometry) ||
                this.pendingBvhGeometries.has(geometry)
            ) {
                return;
            }

            const positionArray = positionAttribute.array;
            const indexArray = indexAttribute.array;
            if (!(positionArray instanceof Float32Array)) return;
            if (
                !(
                    indexArray instanceof Uint16Array ||
                    indexArray instanceof Uint32Array ||
                    indexArray instanceof Int32Array
                )
            ) {
                return;
            }

            const taskId = this.nextBvhPrecomputeTaskId++;
            const position = positionArray.slice();
            const index = indexArray.slice() as BvhIndexArray;
            this.pendingBvhTasks.set(taskId, { generation, geometry });
            this.pendingBvhGeometries.add(geometry);
            this.bvhPrecomputeStats.queued += 1;

            const message: BvhPrecomputeMainToWorkerMessage = {
                type: 'build',
                taskId,
                generation,
                position,
                index
            };
            const transferList: Transferable[] = [position.buffer, index.buffer];
            worker.postMessage(message, transferList);
        });

        if (this.bvhPrecomputeStats.queued === 0) {
            this.log('precompute skipped (no eligible geometries)', {
                generation: this.bvhPrecomputeStats.generation,
                queued: 0,
                completed: 0,
                failed: 0,
                elapsedMs: 0,
                workerBuildTotalMs: 0,
                workerBuildMaxMs: 0
            });
            return;
        }

        this.log('precompute start', {
            generation: this.bvhPrecomputeStats.generation,
            queued: this.bvhPrecomputeStats.queued,
            completed: 0,
            failed: 0
        });
    }

    ensureGroupBvhReady(group: THREE.Object3D | null, options?: BvhQueuePrecomputeOptions): void {
        this.queuePrecomputeForGroup(group, options);
    }

    getPrecomputeSnapshot(): BvhPrecomputeSnapshot {
        const startedAtMs = this.bvhPrecomputeStats.startedAtMs;
        const elapsedMs = startedAtMs > 0 ? this.nowMs() - startedAtMs : undefined;
        return {
            generation: this.bvhPrecomputeStats.generation,
            queued: this.bvhPrecomputeStats.queued,
            completed: this.bvhPrecomputeStats.completed,
            failed: this.bvhPrecomputeStats.failed,
            elapsedMs,
            workerBuildTotalMs: this.bvhPrecomputeStats.workerBuildTotalMs,
            workerBuildMaxMs: this.bvhPrecomputeStats.workerBuildMaxMs,
            pendingTasks: this.pendingBvhTasks.size,
            pendingGeometries: this.pendingBvhGeometries.size,
            cacheSize: this.bvhCache.size
        };
    }

    dispose(): void {
        this.clearCache();
        this.resetPrecomputeQueue();
        if (this.bvhPrecomputeWorker) {
            this.bvhPrecomputeWorker.terminate();
            this.bvhPrecomputeWorker = null;
        }
    }

    private ensureBvhPrecomputeWorker(): Worker | null {
        if (this.bvhPrecomputeWorker) return this.bvhPrecomputeWorker;
        if (typeof Worker === 'undefined') return null;

        try {
            const worker = new BvhPrecomputeWorker();
            worker.onmessage = (event: MessageEvent<BvhPrecomputeWorkerToMainMessage>) => {
                this.handleBvhPrecomputeWorkerMessage(event.data);
            };
            worker.onerror = (event: ErrorEvent) => {
                console.warn('[BvhRaycastManager] BVH precompute worker error:', event.message);
            };
            this.bvhPrecomputeWorker = worker;
            return worker;
        } catch (error) {
            console.warn('[BvhRaycastManager] Failed to initialize BVH precompute worker:', error);
            return null;
        }
    }

    private handleBvhPrecomputeWorkerMessage(message: BvhPrecomputeWorkerToMainMessage): void {
        const pending = this.pendingBvhTasks.get(message.taskId);
        if (!pending) return;

        this.pendingBvhTasks.delete(message.taskId);
        this.pendingBvhGeometries.delete(pending.geometry);

        if (
            pending.generation !== this.bvhPrecomputeGeneration ||
            message.generation !== pending.generation
        ) {
            return;
        }

        if (message.type === 'error') {
            this.bvhPrecomputeStats.failed += 1;
            console.warn('[BvhRaycastManager] BVH precompute failed:', message.message);
            this.maybeLogBvhPrecomputeDone(pending.generation);
            return;
        }

        const geometry = pending.geometry;
        if ((geometry as any).boundsTree) {
            this.bvhPrecomputeStats.completed += 1;
            this.bvhPrecomputeStats.workerBuildTotalMs += message.buildDurationMs;
            this.bvhPrecomputeStats.workerBuildMaxMs = Math.max(
                this.bvhPrecomputeStats.workerBuildMaxMs,
                message.buildDurationMs
            );
            this.maybeLogBvhPrecomputeDone(pending.generation);
            return;
        }

        try {
            const bvh = MeshBVH.deserialize(message.serialized as any, geometry, { setIndex: false });
            this.bvhCache.set(geometry, bvh);
            (geometry as any).boundsTree = bvh;
            this.bvhPrecomputeStats.completed += 1;
            this.bvhPrecomputeStats.workerBuildTotalMs += message.buildDurationMs;
            this.bvhPrecomputeStats.workerBuildMaxMs = Math.max(
                this.bvhPrecomputeStats.workerBuildMaxMs,
                message.buildDurationMs
            );
        } catch (error) {
            this.bvhPrecomputeStats.failed += 1;
            console.warn('[BvhRaycastManager] Failed to deserialize precomputed BVH:', error);
        }

        this.maybeLogBvhPrecomputeDone(pending.generation);
    }

    private maybeLogBvhPrecomputeDone(generation: number): void {
        if (generation !== this.bvhPrecomputeStats.generation) return;
        if (this.pendingBvhTasks.size > 0) return;
        if (this.bvhPrecomputeStats.queued === 0) return;

        const elapsedMs = this.nowMs() - this.bvhPrecomputeStats.startedAtMs;
        this.log('precompute done', {
            generation: this.bvhPrecomputeStats.generation,
            queued: this.bvhPrecomputeStats.queued,
            completed: this.bvhPrecomputeStats.completed,
            failed: this.bvhPrecomputeStats.failed,
            elapsedMs,
            workerBuildTotalMs: this.bvhPrecomputeStats.workerBuildTotalMs,
            workerBuildMaxMs: this.bvhPrecomputeStats.workerBuildMaxMs
        });
    }

    private log(stage: string, payload: BvhLogPayload): void {
        this.onLog?.(stage, payload);
    }
}
