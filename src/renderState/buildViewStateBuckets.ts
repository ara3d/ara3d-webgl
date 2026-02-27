import * as THREE from 'three';
import { Instance } from '../loader/buildInstances';
import { perfDuration, perfNow } from '../perf/perf';
import { ViewStateBucketResult } from './viewStateTypes';

type BucketInstances = {
    opaque: Instance[];
    transparent: Instance[];
};

type GroupKey = string;
type MaterialKey = number;

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

function groupKey(instance: Instance): GroupKey {
    return `${instance.materialId}:${instance.geometry.uuid}`;
}

function mergeInstances(instances: Instance[]): THREE.Mesh | null {
    let indexCount = 0;
    let vertexCount = 0;
    for (const instance of instances) {
        const posAttr = instance.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        const normalAttr = instance.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
        const idxAttr = instance.geometry.getIndex() as THREE.BufferAttribute | undefined;
        if (!posAttr || !normalAttr || !idxAttr) continue;
        vertexCount += posAttr.count;
        indexCount += idxAttr.count;
    }
    if (vertexCount === 0 || indexCount === 0) return null;

    const mergedPositions = new Float32Array(vertexCount * 3);
    const mergedNormals = new Float32Array(vertexCount * 3);
    const mergedIndices = new Uint32Array(indexCount);
    const instanceIds = new Float32Array(vertexCount);
    const materialIds = new Float32Array(vertexCount);
    const normalMatrix = new THREE.Matrix3();

    let vertexOffset = 0;
    let indexOffset = 0;
    for (const instance of instances) {
        const posAttr = instance.geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
        const normalAttr = instance.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
        const idxAttr = instance.geometry.getIndex() as THREE.BufferAttribute | undefined;
        if (!posAttr || !normalAttr || !idxAttr) continue;

        const srcPos = posAttr.array as Float32Array;
        const srcNormal = normalAttr.array as Float32Array;
        const srcIndex = idxAttr.array as Uint16Array | Uint32Array | Int32Array;
        const count = posAttr.count;
        const srcLen = count * 3;
        const dstBase = vertexOffset * 3;

        for (let i = 0; i < count; i++) {
            instanceIds[vertexOffset + i] = instance.instance;
            materialIds[vertexOffset + i] = instance.materialId;
        }

        if (instance.isIdentity) {
            mergedPositions.set(srcPos.subarray(0, srcLen), dstBase);
            mergedNormals.set(srcNormal.subarray(0, srcLen), dstBase);
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

            for (let i = 0; i < count; i++) {
                const srcBase = i * 3;
                const outBase = dstBase + srcBase;
                const x = srcPos[srcBase];
                const y = srcPos[srcBase + 1];
                const z = srcPos[srcBase + 2];
                mergedPositions[outBase] = m00 * x + m01 * y + m02 * z + m03;
                mergedPositions[outBase + 1] = m10 * x + m11 * y + m12 * z + m13;
                mergedPositions[outBase + 2] = m20 * x + m21 * y + m22 * z + m23;

                const nx = srcNormal[srcBase];
                const ny = srcNormal[srcBase + 1];
                const nz = srcNormal[srcBase + 2];
                mergedNormals[outBase] = n00 * nx + n01 * ny + n02 * nz;
                mergedNormals[outBase + 1] = n10 * nx + n11 * ny + n12 * nz;
                mergedNormals[outBase + 2] = n20 * nx + n21 * ny + n22 * nz;
            }
        }

        for (let i = 0; i < idxAttr.count; i++) {
            mergedIndices[indexOffset + i] = srcIndex[i] + vertexOffset;
        }
        vertexOffset += count;
        indexOffset += idxAttr.count;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mergedPositions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(mergedNormals, 3));
    geometry.setAttribute('instanceId', new THREE.Float32BufferAttribute(instanceIds, 1));
    geometry.setAttribute('materialId', new THREE.Float32BufferAttribute(materialIds, 1));
    geometry.setIndex(new THREE.BufferAttribute(mergedIndices, 1));
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    mesh.frustumCulled = false;
    mesh.matrixAutoUpdate = false;
    mesh.userData.pick = { kind: 'viewStateMerged' };
    return mesh;
}

function buildHybridBucket(instances: Instance[]): ViewStateBucketResult {
    const grouped = new Map<GroupKey, Instance[]>();
    for (const instance of instances) {
        const key = groupKey(instance);
        const group = grouped.get(key);
        if (group) {
            group.push(instance);
        } else {
            grouped.set(key, [instance]);
        }
    }

    const instancedMeshes: THREE.InstancedMesh[] = [];
    const singleByMaterial = new Map<MaterialKey, Instance[]>();
    for (const groupedInstances of grouped.values()) {
        if (groupedInstances.length === 0) continue;
        const first = groupedInstances[0];
        const count = groupedInstances.length;
        if (count <= 1) {
            const list = singleByMaterial.get(first.materialId);
            if (list) {
                list.push(first);
            } else {
                singleByMaterial.set(first.materialId, [first]);
            }
            continue;
        }

        const geometry = first.geometry.clone();
        const instanced = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), count);
        instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);

        const instanceIds = new Float32Array(count);
        const materialIds = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const item = groupedInstances[i];
            instanced.setMatrixAt(i, item.transform);
            instanceIds[i] = item.instance;
            materialIds[i] = item.materialId;
        }
        instanced.instanceMatrix.needsUpdate = true;
        instanced.geometry.setAttribute('instanceId', new THREE.InstancedBufferAttribute(instanceIds, 1));
        instanced.geometry.setAttribute('materialId', new THREE.InstancedBufferAttribute(materialIds, 1));
        instanced.frustumCulled = false;
        instanced.matrixAutoUpdate = false;
        instanced.userData.pick = {
            kind: 'instanced',
            instanceIndices: Array.from(instanceIds)
        };
        instancedMeshes.push(instanced);
    }

    const mergedSingleMeshes: THREE.Mesh[] = [];
    for (const groupedSingles of singleByMaterial.values()) {
        const merged = mergeInstances(groupedSingles);
        if (merged) mergedSingleMeshes.push(merged);
    }

    return { meshes: [...instancedMeshes, ...mergedSingleMeshes] };
}

export function buildViewStateBuckets(instances: Array<Instance | undefined>): {
    opaque: ViewStateBucketResult;
    transparent: ViewStateBucketResult;
} {
    const startedAt = perfNow();
    const split = splitBuckets(instances);
    const opaque = buildHybridBucket(split.opaque);
    const transparent = buildHybridBucket(split.transparent);
    perfDuration('viewState.buildBuckets', startedAt, {
        sourceCount: instances.length,
        opaqueCount: split.opaque.length,
        transparentCount: split.transparent.length
    });
    return { opaque, transparent };
}
