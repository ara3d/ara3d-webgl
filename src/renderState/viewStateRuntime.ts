import * as THREE from 'three';
import { Instance } from '../loader/buildInstances';
import { perfDuration, perfNow } from '../perf/perf';
import { buildViewStateBuckets } from './buildViewStateBuckets';
import { createViewStateMaterial } from './viewStateMaterial';
import { buildViewStateTextures, ViewStateTable } from './viewStateTable';
import { ViewStateRenderModel } from './viewStateTypes';

function buildBaseMaterialLookup(instances: Array<Instance | undefined>): {
    data: Uint8Array;
    materialCount: number;
} {
    let maxMaterialId = -1;
    for (const instance of instances) {
        if (!instance) continue;
        maxMaterialId = Math.max(maxMaterialId, instance.materialId);
    }

    const materialCount = Math.max(1, maxMaterialId + 1);
    const data = new Uint8Array(materialCount * 4);

    for (const instance of instances) {
        if (!instance) continue;
        const mat = instance.material as THREE.MeshStandardMaterial;
        const offset = instance.materialId * 4;
        data[offset] = Math.round(mat.color.r * 255);
        data[offset + 1] = Math.round(mat.color.g * 255);
        data[offset + 2] = Math.round(mat.color.b * 255);
        data[offset + 3] = Math.round((mat.opacity ?? 1) * 255);
    }

    return { data, materialCount };
}

export type ViewStateRuntime = {
    model: ViewStateRenderModel;
    state: ViewStateTable;
};

export function buildViewStateRuntime(instances: Array<Instance | undefined>): ViewStateRuntime {
    const startedAt = perfNow();
    const { opaque, transparent } = buildViewStateBuckets(instances);
    const { data: baseMaterialLookup, materialCount } = buildBaseMaterialLookup(instances);
    const instanceCount = instances.length;
    const textures = buildViewStateTextures({
        instanceCount,
        materialCount,
        baseMaterialColors: baseMaterialLookup
    });

    const materialOpaque = createViewStateMaterial({
        textures,
        instanceCount,
        materialCount,
        transparentPass: false
    });

    const materialTransparent = createViewStateMaterial({
        textures,
        instanceCount,
        materialCount,
        transparentPass: true
    });

    const group = new THREE.Group();
    group.name = 'ViewStateRoot';
    group.rotation.x = -Math.PI / 2;

    for (let i = 0; i < opaque.meshes.length; i++) {
        const meshOpaque = opaque.meshes[i];
        meshOpaque.material = materialOpaque;
        meshOpaque.name = `ViewStateOpaqueBucket_${i}`;
        group.add(meshOpaque);
    }

    for (let i = 0; i < transparent.meshes.length; i++) {
        const meshTransparent = transparent.meshes[i];
        meshTransparent.material = materialTransparent;
        meshTransparent.name = `ViewStateTransparentBucket_${i}`;
        meshTransparent.renderOrder = 10;
        group.add(meshTransparent);
    }

    const state = new ViewStateTable(textures, instanceCount);

    const model: ViewStateRenderModel = {
        group,
        textures,
        materialOpaque,
        materialTransparent
    };

    perfDuration('viewState.buildRuntime', startedAt, {
        instanceCount,
        materialCount,
        bucketCount: group.children.length
    });

    return { model, state };
}
