import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createViewStateMaterial, setViewStateMaterialSelectionColor } from './viewStateMaterial';

function createTexture(width = 1, height = 1): THREE.DataTexture {
    const data = new Uint8Array(width * height * 4);
    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    texture.needsUpdate = true;
    return texture;
}

describe('viewStateMaterial selection style', () => {
    it('updates selection color through helper without recompiling material', () => {
        const material = createViewStateMaterial({
            textures: {
                baseMaterial: createTexture(),
                flags: createTexture(),
                colorOverrides: createTexture()
            },
            instanceCount: 1,
            materialCount: 1,
            transparentPass: false
        });

        setViewStateMaterialSelectionColor(material, '#ff00aa');

        const uniforms = (
            material.userData as { viewStateSelectionUniforms: { color: THREE.Color } }
        ).viewStateSelectionUniforms;
        expect(uniforms.color.getHexString()).toBe('ff00aa');
    });
});
