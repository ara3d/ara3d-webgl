import * as THREE from 'three';
import { ViewStateTextures } from './viewStateTypes';

type ViewStateMaterialOptions = {
    textures: ViewStateTextures;
    instanceCount: number;
    materialCount: number;
    transparentPass: boolean;
};

export type ViewStateSelectionUniforms = {
    // Fill tint color applied to selected elements.
    color: THREE.Color;
    // Constant fill blend [0..1] for all selected fragments.
    // 0 = keep original shaded color, 1 = fully replace with `color`.
    mix: number;
};

type ViewStateSelectionMaterialUserData = {
    viewStateSelectionUniforms?: ViewStateSelectionUniforms;
    viewStateSelectionMixUniform?: { value: number };
    viewStateOpacityDitherScale?: number;
    viewStateOpacityDitherScaleUniform?: { value: number };
    viewStateGhostOpacity?: number;
    viewStateGhostOpacityUniform?: { value: number };
};

export type ViewStateSelectionStyle = {
    color?: THREE.ColorRepresentation;
    mix?: number;
    opacityDitherScale?: number;
    ghostOpacity?: number;
};

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

function clampOpacityDitherScale(value: number): number {
    if (!Number.isFinite(value)) return 32;
    return Math.max(1, Math.min(512, value));
}

function clampOpacity(value: number): number {
    if (!Number.isFinite(value)) return 0.2;
    return Math.max(0, Math.min(1, value));
}

function getSelectionUserData(
    material: THREE.Material | null | undefined
): ViewStateSelectionMaterialUserData | null {
    if (!material) return null;
    return material.userData as ViewStateSelectionMaterialUserData;
}

export function setViewStateMaterialSelectionColor(
    material: THREE.Material | null | undefined,
    color: THREE.ColorRepresentation
): void {
    const uniforms = getSelectionUserData(material)?.viewStateSelectionUniforms;
    if (!uniforms) return;
    uniforms.color.set(color);
}

export function setViewStateMaterialSelectionMix(
    material: THREE.Material | null | undefined,
    mix: number
): void {
    const userData = getSelectionUserData(material);
    const uniforms = userData?.viewStateSelectionUniforms;
    if (!uniforms) return;
    const clampedMix = clamp01(mix);
    uniforms.mix = clampedMix;
    if (userData?.viewStateSelectionMixUniform) {
        userData.viewStateSelectionMixUniform.value = clampedMix;
    }
}

export function setViewStateMaterialSelectionStyle(
    material: THREE.Material | null | undefined,
    style: ViewStateSelectionStyle
): void {
    if (!style) return;
    if (style.color !== undefined) {
        setViewStateMaterialSelectionColor(material, style.color);
    }
    if (style.mix !== undefined) {
        setViewStateMaterialSelectionMix(material, style.mix);
    }
    if (style.opacityDitherScale !== undefined) {
        setViewStateMaterialOpacityDitherScale(material, style.opacityDitherScale);
    }
    if (style.ghostOpacity !== undefined) {
        setViewStateMaterialGhostOpacity(material, style.ghostOpacity);
    }
}

export function setViewStateMaterialOpacityDitherScale(
    material: THREE.Material | null | undefined,
    scale: number
): void {
    const userData = getSelectionUserData(material);
    if (!userData) return;
    const clamped = clampOpacityDitherScale(scale);
    userData.viewStateOpacityDitherScale = clamped;
    if (userData.viewStateOpacityDitherScaleUniform) {
        userData.viewStateOpacityDitherScaleUniform.value = clamped;
    }
}

export function setViewStateMaterialGhostOpacity(
    material: THREE.Material | null | undefined,
    opacity: number
): void {
    const userData = getSelectionUserData(material);
    if (!userData) return;
    const clamped = clampOpacity(opacity);
    userData.viewStateGhostOpacity = clamped;
    if (userData.viewStateGhostOpacityUniform) {
        userData.viewStateGhostOpacityUniform.value = clamped;
    }
}

export function createViewStateMaterial(
    options: ViewStateMaterialOptions
): THREE.MeshStandardMaterial {
    const selectionUniforms = {
        color: new THREE.Color(0xffff00),
        // Base fill tint amount across the whole selected surface.
        mix: 1,
    };
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0.1,
        transparent: options.transparentPass,
        depthWrite: !options.transparentPass,
        side: THREE.DoubleSide,
    });
    material.userData.viewStateSelectionUniforms = selectionUniforms;
    (
        material.userData as ViewStateSelectionMaterialUserData
    ).viewStateOpacityDitherScale = 32;
    (material.userData as ViewStateSelectionMaterialUserData).viewStateGhostOpacity = 0.2;

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uBaseMaterialTex = {
            value: options.textures.baseMaterial,
        };
        shader.uniforms.uViewFlagsTex = { value: options.textures.flags };
        shader.uniforms.uColorOverridesTex = {
            value: options.textures.colorOverrides,
        };
        shader.uniforms.uSelectionColor = { value: selectionUniforms.color };
        shader.uniforms.uSelectionMix = { value: selectionUniforms.mix };
        const userData = material.userData as ViewStateSelectionMaterialUserData;
        userData.viewStateSelectionMixUniform = shader.uniforms.uSelectionMix as { value: number };
        shader.uniforms.uOpacityDitherScale = {
            value: userData.viewStateOpacityDitherScale ?? 32,
        };
        userData.viewStateOpacityDitherScaleUniform = shader.uniforms
            .uOpacityDitherScale as { value: number };
        shader.uniforms.uGhostOpacity = {
            value: userData.viewStateGhostOpacity ?? 0.2
        };
        userData.viewStateGhostOpacityUniform = shader.uniforms.uGhostOpacity as { value: number };
        shader.uniforms.uTransparentPass = {
            value: options.transparentPass ? 1 : 0,
        };
        shader.uniforms.uInstanceCount = {
            value: Math.max(1, options.instanceCount),
        };
        shader.uniforms.uMaterialCount = {
            value: Math.max(1, options.materialCount),
        };
        shader.uniforms.uViewFlagsTexWidth = {
            value: Math.max(1, options.textures.flags.image.width),
        };
        shader.uniforms.uViewFlagsTexHeight = {
            value: Math.max(1, options.textures.flags.image.height),
        };
        shader.uniforms.uColorOverridesTexWidth = {
            value: Math.max(1, options.textures.colorOverrides.image.width),
        };
        shader.uniforms.uColorOverridesTexHeight = {
            value: Math.max(1, options.textures.colorOverrides.image.height),
        };
        shader.uniforms.uBaseMaterialTexWidth = {
            value: Math.max(1, options.textures.baseMaterial.image.width),
        };
        shader.uniforms.uBaseMaterialTexHeight = {
            value: Math.max(1, options.textures.baseMaterial.image.height),
        };

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>
attribute float instanceId;
attribute float materialId;
varying float vInstanceId;
varying float vMaterialId;
varying vec3 vWorldPos;`
            )
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
vInstanceId = instanceId;
vMaterialId = materialId;
vec4 worldPos = vec4(position, 1.0);
#ifdef USE_INSTANCING
worldPos = instanceMatrix * worldPos;
#endif
vWorldPos = (modelMatrix * worldPos).xyz;`
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>
uniform sampler2D uBaseMaterialTex;
uniform sampler2D uViewFlagsTex;
uniform sampler2D uColorOverridesTex;
uniform vec3 uSelectionColor;
uniform float uSelectionMix;
uniform float uOpacityDitherScale;
uniform float uGhostOpacity;
uniform float uTransparentPass;
uniform float uInstanceCount;
uniform float uMaterialCount;
uniform float uViewFlagsTexWidth;
uniform float uViewFlagsTexHeight;
uniform float uColorOverridesTexWidth;
uniform float uColorOverridesTexHeight;
uniform float uBaseMaterialTexWidth;
uniform float uBaseMaterialTexHeight;
varying float vInstanceId;
varying float vMaterialId;
varying vec3 vWorldPos;

vec4 sampleLookupPacked(sampler2D t, float id, float width, float height) {
    float ix = mod(id, width);
    float iy = floor(id / width);
    vec2 uv = vec2((ix + 0.5) / width, (iy + 0.5) / height);
    return texture2D(t, uv);
}`
            )
            .replace(
                'vec4 diffuseColor = vec4( diffuse, opacity );',
                `vec4 baseMaterial = sampleLookupPacked(
    uBaseMaterialTex,
    vMaterialId,
    uBaseMaterialTexWidth,
    uBaseMaterialTexHeight
);
vec4 stateFlags = sampleLookupPacked(
    uViewFlagsTex,
    vInstanceId,
    uViewFlagsTexWidth,
    uViewFlagsTexHeight
);
vec4 colorOverride = sampleLookupPacked(
    uColorOverridesTex,
    vInstanceId,
    uColorOverridesTexWidth,
    uColorOverridesTexHeight
);

float rawFlags = floor(stateFlags.r * 255.0 + 0.5);
bool isVisible = mod(rawFlags, 2.0) >= 1.0;
bool isSelected = mod(floor(rawFlags / 2.0), 2.0) >= 1.0;
bool isGhosted = mod(floor(rawFlags / 4.0), 2.0) >= 1.0;
bool hasOpacityOverride = mod(floor(rawFlags / 8.0), 2.0) >= 1.0;
bool hasColorOverride = mod(floor(rawFlags / 16.0), 2.0) >= 1.0;

vec3 finalBaseColor = baseMaterial.rgb;
float finalOpacity = baseMaterial.a;

if (hasColorOverride) {
    finalBaseColor = colorOverride.rgb;
}

if (isGhosted) {
    finalOpacity = min(finalOpacity, clamp(uGhostOpacity, 0.0, 1.0));
}

if (hasOpacityOverride) {
    finalOpacity = min(finalOpacity, colorOverride.a);
}

if (isSelected) {
    float fillMix = clamp(uSelectionMix, 0.0, 1.0);
    finalBaseColor = mix(finalBaseColor, uSelectionColor, fillMix);
}

if (!isVisible) {
    discard;
}

// Opaque buckets use non-transparent materials for performance. To support
// runtime ghosting/opacity on those buckets without rebuilding/sorting,
// approximate alpha using ordered dithering.
if (uTransparentPass < 0.5 && finalOpacity < 0.999) {
    vec3 worldCell = floor(vWorldPos * uOpacityDitherScale);
    float noise = fract(
        sin(dot(worldCell + vec3(vInstanceId * 0.173), vec3(12.9898, 78.233, 45.164))) * 43758.5453
    );
    if (noise > clamp(finalOpacity, 0.0, 1.0)) {
        discard;
    }
    finalOpacity = 1.0;
}

vec4 diffuseColor = vec4(finalBaseColor, finalOpacity);`
            );
    };

    material.customProgramCacheKey = () =>
        `view-state-${options.transparentPass ? 'transparent' : 'opaque'}-v3`;

    return material;
}
