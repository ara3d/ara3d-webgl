import * as THREE from 'three';
import { InstanceIndex } from '../loader/bimData';

export const enum ViewStateFlag {
    Visible = 1 << 0,
    Selected = 1 << 1,
    Ghosted = 1 << 2,
    OpacityOverride = 1 << 3,
    ColorOverride = 1 << 4
}

export type ViewStateTextures = {
    baseMaterial: THREE.DataTexture;
    flags: THREE.DataTexture;
    colorOverrides: THREE.DataTexture;
};

export type ViewStateBucketBuildInput = {
    instances: Array<{
        instanceId: InstanceIndex;
        materialId: number;
        isTransparent: boolean;
        transform: THREE.Matrix4;
        isIdentity: boolean;
        geometry: THREE.BufferGeometry;
    }>;
};

export type ViewStateBucketResult = {
    meshes: THREE.Mesh[];
};

export type ViewStateRenderModel = {
    group: THREE.Group;
    textures: ViewStateTextures;
    materialOpaque: THREE.MeshStandardMaterial;
    materialTransparent: THREE.MeshStandardMaterial;
};
