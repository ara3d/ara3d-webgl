import * as THREE from 'three';
import { Instance } from '../loader/buildInstances';
import { perfDuration, perfNow } from '../perf/perf';
import { ViewStateBucketResult } from './viewStateTypes';

type BucketInstances = {
    opaque: Instance[];
    transparent: Instance[];
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
    let indexCount = 0;
    let vertexCount = 0;
    for (const instance of instances) {
        const pos = instance.geometry.getAttribute('position');
        const idx = instance.geometry.getIndex();
        if (!pos || !idx) continue;
        indexCount += idx.count;
        vertexCount += pos.count;
    }

    const mergedPositions = new Float32Array(vertexCount * 3);
    const mergedIndices = new Uint32Array(indexCount);
    const instanceIds = new Float32Array(vertexCount);
    const materialIds = new Float32Array(vertexCount);
    const triToInstance = new Uint32Array(indexCount / 3);

    let runningVertexOffset = 0;
    let runningIndexOffset = 0;
    const tmp = new THREE.Vector3();

    for (const instance of instances) {
        const posAttr = instance.geometry.getAttribute('position') as THREE.BufferAttribute;
        const idxAttr = instance.geometry.getIndex() as THREE.BufferAttribute;
        if (!posAttr || !idxAttr) continue;

        const srcPos = posAttr.array as Float32Array;
        const srcIndex = idxAttr.array as Uint32Array;
        const vertexCountForInstance = posAttr.count;
        const triStart = runningIndexOffset / 3;

        for (let i = 0; i < vertexCountForInstance; i++) {
            const srcBase = i * 3;
            const dstBase = (runningVertexOffset + i) * 3;

            if (instance.isIdentity) {
                mergedPositions[dstBase] = srcPos[srcBase];
                mergedPositions[dstBase + 1] = srcPos[srcBase + 1];
                mergedPositions[dstBase + 2] = srcPos[srcBase + 2];
            } else {
                tmp.set(srcPos[srcBase], srcPos[srcBase + 1], srcPos[srcBase + 2]).applyMatrix4(
                    instance.transform
                );
                mergedPositions[dstBase] = tmp.x;
                mergedPositions[dstBase + 1] = tmp.y;
                mergedPositions[dstBase + 2] = tmp.z;
            }

            instanceIds[runningVertexOffset + i] = instance.instance;
            materialIds[runningVertexOffset + i] = instance.materialId;
        }

        for (let i = 0; i < idxAttr.count; i++) {
            mergedIndices[runningIndexOffset + i] = srcIndex[i] + runningVertexOffset;
        }

        const triCount = idxAttr.count / 3;
        for (let t = 0; t < triCount; t++) {
            triToInstance[triStart + t] = instance.instance;
        }

        runningVertexOffset += vertexCountForInstance;
        runningIndexOffset += idxAttr.count;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    geometry.setAttribute('instanceId', new THREE.Float32BufferAttribute(instanceIds, 1));
    geometry.setAttribute('materialId', new THREE.Float32BufferAttribute(materialIds, 1));
    geometry.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
    geometry.computeVertexNormals();

    return {
        geometry,
        triangleToInstance: triToInstance
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
