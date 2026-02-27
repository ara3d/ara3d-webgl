import * as THREE from 'three';
import { Instance } from '../loader/buildInstances';
import { perfDuration, perfNow } from '../perf/perf';
import { ViewStateBucketResult } from './viewStateTypes';

type BucketInstances = {
    opaque: Instance[];
    transparent: Instance[];
};

type CachedGeometryBuffers = {
    positions: Float32Array;
    normals: Float32Array;
    indices: Uint32Array | Uint16Array | Int32Array;
    vertexCount: number;
    indexCount: number;
};

function splitBuckets(instances: Array<Instance | undefined>): BucketInstances {
    const opaque: Instance[] = [];
    const transparent: Instance[] = [];

    for (const instance of instances) {
        if (!instance) continue;
        const mat = instance.material as THREE.MeshStandardMaterial;
        if (mat.transparent || mat.opacity < 0.999) {
            transparent.push(instance);
            continue;
        }
        opaque.push(instance);
    }

    return { opaque, transparent };
}

function mergeBucket(instances: Instance[]): ViewStateBucketResult {
    const geometryCache = new Map<THREE.BufferGeometry, CachedGeometryBuffers>();
    const getGeometryBuffers = (geometry: THREE.BufferGeometry): CachedGeometryBuffers | null => {
        const cached = geometryCache.get(geometry);
        if (cached) return cached;

        const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        const normalAttr = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
        const idxAttr = geometry.getIndex() as THREE.BufferAttribute | undefined;
        if (!posAttr || !normalAttr || !idxAttr) return null;

        const buffers: CachedGeometryBuffers = {
            positions: posAttr.array as Float32Array,
            normals: normalAttr.array as Float32Array,
            indices: idxAttr.array as Uint32Array | Uint16Array | Int32Array,
            vertexCount: posAttr.count,
            indexCount: idxAttr.count
        };
        geometryCache.set(geometry, buffers);
        return buffers;
    };

    let indexCount = 0;
    let vertexCount = 0;
    for (const instance of instances) {
        const buffers = getGeometryBuffers(instance.geometry);
        if (!buffers) continue;
        indexCount += buffers.indexCount;
        vertexCount += buffers.vertexCount;
    }

    const mergedPositions = new Float32Array(vertexCount * 3);
    const mergedNormals = new Float32Array(vertexCount * 3);
    const mergedIndices = new Uint32Array(indexCount);
    const instanceIds = new Float32Array(vertexCount);
    const materialIds = new Float32Array(vertexCount);

    let runningVertexOffset = 0;
    let runningIndexOffset = 0;
    const normalMatrix = new THREE.Matrix3();

    for (const instance of instances) {
        const buffers = getGeometryBuffers(instance.geometry);
        if (!buffers) continue;

        const srcPos = buffers.positions;
        const srcNormal = buffers.normals;
        const srcIndex = buffers.indices;
        const vertexCountForInstance = buffers.vertexCount;
        const dstVertexBase = runningVertexOffset * 3;
        const srcVertexLen = vertexCountForInstance * 3;

        for (let i = 0; i < vertexCountForInstance; i++) {
            instanceIds[runningVertexOffset + i] = instance.instance;
            materialIds[runningVertexOffset + i] = instance.materialId;
        }

        if (instance.isIdentity) {
            mergedPositions.set(srcPos.subarray(0, srcVertexLen), dstVertexBase);
            mergedNormals.set(srcNormal.subarray(0, srcVertexLen), dstVertexBase);
        } else {
            const m = instance.transform.elements;
            const m00 = m[0], m01 = m[4], m02 = m[8], m03 = m[12];
            const m10 = m[1], m11 = m[5], m12 = m[9], m13 = m[13];
            const m20 = m[2], m21 = m[6], m22 = m[10], m23 = m[14];

            normalMatrix.getNormalMatrix(instance.transform);
            const nm = normalMatrix.elements;
            const n00 = nm[0], n01 = nm[3], n02 = nm[6];
            const n10 = nm[1], n11 = nm[4], n12 = nm[7];
            const n20 = nm[2], n21 = nm[5], n22 = nm[8];

            for (let i = 0; i < vertexCountForInstance; i++) {
                const srcBase = i * 3;
                const dstBase = dstVertexBase + srcBase;
                const x = srcPos[srcBase];
                const y = srcPos[srcBase + 1];
                const z = srcPos[srcBase + 2];
                mergedPositions[dstBase] = m00 * x + m01 * y + m02 * z + m03;
                mergedPositions[dstBase + 1] = m10 * x + m11 * y + m12 * z + m13;
                mergedPositions[dstBase + 2] = m20 * x + m21 * y + m22 * z + m23;

                const nx = srcNormal[srcBase];
                const ny = srcNormal[srcBase + 1];
                const nz = srcNormal[srcBase + 2];
                mergedNormals[dstBase] = n00 * nx + n01 * ny + n02 * nz;
                mergedNormals[dstBase + 1] = n10 * nx + n11 * ny + n12 * nz;
                mergedNormals[dstBase + 2] = n20 * nx + n21 * ny + n22 * nz;
            }
        }

        for (let i = 0; i < buffers.indexCount; i++) {
            mergedIndices[runningIndexOffset + i] = srcIndex[i] + runningVertexOffset;
        }

        runningVertexOffset += vertexCountForInstance;
        runningIndexOffset += buffers.indexCount;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
    geometry.setAttribute('instanceId', new THREE.Float32BufferAttribute(instanceIds, 1));
    geometry.setAttribute('materialId', new THREE.Float32BufferAttribute(materialIds, 1));
    geometry.setIndex(new THREE.BufferAttribute(mergedIndices, 1));

    return {
        geometry
    };
}

export function buildViewStateBuckets(instances: Array<Instance | undefined>): {
    opaque: ViewStateBucketResult;
    transparent: ViewStateBucketResult;
} {
    const startedAt = perfNow();
    const split = splitBuckets(instances);
    const opaque = mergeBucket(split.opaque);
    const transparent = mergeBucket(split.transparent);
    perfDuration('viewState.buildBuckets', startedAt, {
        sourceCount: instances.length,
        opaqueCount: split.opaque.length,
        transparentCount: split.transparent.length
    });
    return { opaque, transparent };
}
