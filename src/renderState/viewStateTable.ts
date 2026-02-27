import * as THREE from 'three';
import { perfDuration, perfNow } from '../perf/perf';
import { ViewStateFlag, ViewStateTextures } from './viewStateTypes';

type BuildViewStateTexturesOptions = {
    instanceCount: number;
    baseMaterialColors: Uint8Array;
    materialCount: number;
};

function buildPackedTextureData(entryCount: number): {
    width: number;
    height: number;
    data: Uint8Array;
} {
    const safeEntryCount = Math.max(1, entryCount);
    const maxWidth = 2048;
    const width = Math.min(maxWidth, safeEntryCount);
    const height = Math.ceil(safeEntryCount / width);
    return {
        width,
        height,
        data: new Uint8Array(width * height * 4)
    };
}

function setupNearest(texture: THREE.DataTexture): THREE.DataTexture {
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
}

export function buildViewStateTextures(options: BuildViewStateTexturesOptions): ViewStateTextures {
    const packedFlags = buildPackedTextureData(options.instanceCount);
    const packedOverrides = buildPackedTextureData(options.instanceCount);
    const packedBaseMaterials = buildPackedTextureData(options.materialCount);

    const flagsData = packedFlags.data;
    for (let i = 0; i < options.instanceCount; i++) {
        flagsData[i * 4] = ViewStateFlag.Visible;
    }

    const colorOverridesData = packedOverrides.data;
    packedBaseMaterials.data.set(options.baseMaterialColors.subarray(0, options.materialCount * 4), 0);

    const flags = setupNearest(
        new THREE.DataTexture(
            flagsData,
            packedFlags.width,
            packedFlags.height,
            THREE.RGBAFormat,
            THREE.UnsignedByteType
        )
    );

    const colorOverrides = setupNearest(
        new THREE.DataTexture(
            colorOverridesData,
            packedOverrides.width,
            packedOverrides.height,
            THREE.RGBAFormat,
            THREE.UnsignedByteType
        )
    );

    const baseMaterial = setupNearest(
        new THREE.DataTexture(
            packedBaseMaterials.data,
            packedBaseMaterials.width,
            packedBaseMaterials.height,
            THREE.RGBAFormat,
            THREE.UnsignedByteType
        )
    );

    return {
        baseMaterial,
        flags,
        colorOverrides
    };
}

export class ViewStateTable {
    readonly flagsData: Uint8Array;
    readonly colorOverridesData: Uint8Array;
    private readonly instanceCount: number;
    private readonly textures: ViewStateTextures;

    constructor(textures: ViewStateTextures, instanceCount: number) {
        this.textures = textures;
        this.instanceCount = instanceCount;
        this.flagsData = textures.flags.image.data as Uint8Array;
        this.colorOverridesData = textures.colorOverrides.image.data as Uint8Array;
    }

    setVisibility(instanceIds: number[], visible: boolean): void {
        this.applyFlag(instanceIds, ViewStateFlag.Visible, visible);
    }

    setSelected(instanceIds: number[], selected: boolean): void {
        this.applyFlag(instanceIds, ViewStateFlag.Selected, selected);
    }

    setGhosted(instanceIds: number[], ghosted: boolean): void {
        this.applyFlag(instanceIds, ViewStateFlag.Ghosted, ghosted);
    }

    setColorOverride(instanceIds: number[], color: THREE.Color | null): void {
        const startedAt = perfNow();
        for (const instanceId of instanceIds) {
            if (instanceId < 0 || instanceId >= this.instanceCount) continue;
            const base = instanceId * 4;
            if (!color) {
                this.colorOverridesData[base + 0] = 0;
                this.colorOverridesData[base + 1] = 0;
                this.colorOverridesData[base + 2] = 0;
                this.colorOverridesData[base + 3] = 0;
                continue;
            }
            this.colorOverridesData[base + 0] = Math.round(color.r * 255);
            this.colorOverridesData[base + 1] = Math.round(color.g * 255);
            this.colorOverridesData[base + 2] = Math.round(color.b * 255);
            this.colorOverridesData[base + 3] = 255;
        }
        this.textures.colorOverrides.needsUpdate = true;
        perfDuration('viewState.colorOverride', startedAt, {
            count: instanceIds.length
        });
    }

    clearColorOverrides(instanceIds: number[]): void {
        this.setColorOverride(instanceIds, null);
    }

    applyPendingGpuUpdates(): void {
        this.textures.flags.needsUpdate = true;
        this.textures.colorOverrides.needsUpdate = true;
    }

    private applyFlag(instanceIds: number[], flag: ViewStateFlag, enabled: boolean): void {
        const startedAt = perfNow();
        for (const instanceId of instanceIds) {
            if (instanceId < 0 || instanceId >= this.instanceCount) continue;
            const offset = instanceId * 4;
            const current = this.flagsData[offset];
            this.flagsData[offset] = enabled ? current | flag : current & ~flag;
        }
        this.textures.flags.needsUpdate = true;
        perfDuration('viewState.flagPatch', startedAt, {
            count: instanceIds.length,
            flag,
            enabled
        });
    }
}
