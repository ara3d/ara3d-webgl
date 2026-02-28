import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import {
    createViewStateMaterial,
    setViewStateMaterialGhostOpacity,
    setViewStateMaterialOpacityDitherScale,
    setViewStateMaterialSelectionColor,
    setViewStateMaterialSelectionMix,
    setViewStateMaterialSelectionStyle
} from './viewStateMaterial';

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

    it('updates selection mix and syncs compiled shader uniform without recompile', () => {
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

        const shader = {
            uniforms: {},
            vertexShader: '#include <common>\n#include <begin_vertex>',
            fragmentShader: '#include <common>\nvec4 diffuseColor = vec4( diffuse, opacity );'
        } as any;
        material.onBeforeCompile?.(shader);
        setViewStateMaterialSelectionMix(material, 0.42);

        expect(shader.uniforms.uSelectionMix.value).toBeCloseTo(0.42, 5);
        const uniforms = (
            material.userData as { viewStateSelectionUniforms: { mix: number } }
        ).viewStateSelectionUniforms;
        expect(uniforms.mix).toBeCloseTo(0.42, 5);
    });

    it('clamps mix through style helper', () => {
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

        setViewStateMaterialSelectionStyle(material, { color: '#3366ff', mix: 2.5 });
        const uniforms = (
            material.userData as {
                viewStateSelectionUniforms: { color: THREE.Color; mix: number };
            }
        ).viewStateSelectionUniforms;
        expect(uniforms.color.getHexString()).toBe('3366ff');
        expect(uniforms.mix).toBe(1);
    });

    it('supports separate color and opacity override flags in shader logic', () => {
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

        const shader = {
            uniforms: {},
            vertexShader: '#include <common>\n#include <begin_vertex>',
            fragmentShader: '#include <common>\nvec4 diffuseColor = vec4( diffuse, opacity );'
        } as any;
        material.onBeforeCompile?.(shader);

        expect(shader.fragmentShader.includes('hasOpacityOverride')).toBe(true);
        expect(shader.fragmentShader.includes('hasColorOverride')).toBe(true);
        expect(shader.fragmentShader.includes('uTransparentPass')).toBe(true);
        expect(shader.fragmentShader.includes('uOpacityDitherScale')).toBe(true);
        expect(shader.fragmentShader.includes('uGhostOpacity')).toBe(true);
        expect(shader.vertexShader.includes('vWorldPos')).toBe(true);
        expect(shader.fragmentShader.includes('vWorldPos')).toBe(true);
    });

    it('updates opacity dither scale and syncs compiled shader uniform', () => {
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

        const shader = {
            uniforms: {},
            vertexShader: '#include <common>\n#include <begin_vertex>',
            fragmentShader: '#include <common>\nvec4 diffuseColor = vec4( diffuse, opacity );'
        } as any;
        material.onBeforeCompile?.(shader);
        setViewStateMaterialOpacityDitherScale(material, 96);

        expect(shader.uniforms.uOpacityDitherScale.value).toBe(96);
        const userData = material.userData as { viewStateOpacityDitherScale: number };
        expect(userData.viewStateOpacityDitherScale).toBe(96);
    });

    it('updates opacity dither scale through style helper', () => {
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

        const shader = {
            uniforms: {},
            vertexShader: '#include <common>\n#include <begin_vertex>',
            fragmentShader: '#include <common>\nvec4 diffuseColor = vec4( diffuse, opacity );'
        } as any;
        material.onBeforeCompile?.(shader);
        setViewStateMaterialSelectionStyle(material, { opacityDitherScale: 128 });

        expect(shader.uniforms.uOpacityDitherScale.value).toBe(128);
        const userData = material.userData as { viewStateOpacityDitherScale: number };
        expect(userData.viewStateOpacityDitherScale).toBe(128);
    });

    it('updates ghost opacity and syncs compiled shader uniform', () => {
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

        const shader = {
            uniforms: {},
            vertexShader: '#include <common>\n#include <begin_vertex>',
            fragmentShader: '#include <common>\nvec4 diffuseColor = vec4( diffuse, opacity );'
        } as any;
        material.onBeforeCompile?.(shader);
        setViewStateMaterialGhostOpacity(material, 0.08);

        expect(shader.uniforms.uGhostOpacity.value).toBeCloseTo(0.08, 5);
        const userData = material.userData as { viewStateGhostOpacity: number };
        expect(userData.viewStateGhostOpacity).toBeCloseTo(0.08, 5);
    });

    it('updates ghost opacity through style helper', () => {
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

        const shader = {
            uniforms: {},
            vertexShader: '#include <common>\n#include <begin_vertex>',
            fragmentShader: '#include <common>\nvec4 diffuseColor = vec4( diffuse, opacity );'
        } as any;
        material.onBeforeCompile?.(shader);
        setViewStateMaterialSelectionStyle(material, { ghostOpacity: 0.06 });

        expect(shader.uniforms.uGhostOpacity.value).toBeCloseTo(0.06, 5);
        const userData = material.userData as { viewStateGhostOpacity: number };
        expect(userData.viewStateGhostOpacity).toBeCloseTo(0.06, 5);
    });
});
