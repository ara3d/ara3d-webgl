import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildViewStateTextures, ViewStateTable } from './viewStateTable';
import { ViewStateFlag } from './viewStateTypes';

describe('ViewStateTable', () => {
    it('patches flags and color overrides', () => {
        const textures = buildViewStateTextures({
            instanceCount: 4,
            materialCount: 2,
            baseMaterialColors: new Uint8Array([
                255, 0, 0, 255, 0, 255, 0, 255
            ])
        });
        const table = new ViewStateTable(textures, 4);

        table.setSelected([1, 2], true);
        table.setVisibility([2], false);
        table.setColorOverride([1], new THREE.Color(0, 0, 1));

        const flags = table.flagsData;
        expect(flags[1 * 4] & ViewStateFlag.Selected).toBe(ViewStateFlag.Selected);
        expect(flags[2 * 4] & ViewStateFlag.Selected).toBe(ViewStateFlag.Selected);
        expect(flags[2 * 4] & ViewStateFlag.Visible).toBe(0);

        const colors = table.colorOverridesData;
        expect(colors[1 * 4 + 2]).toBe(255);
        expect(colors[1 * 4 + 3]).toBe(255);
    });
});
