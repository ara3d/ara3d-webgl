import * as THREE from 'three';
import { ViewStateTextures } from './viewStateTypes';

type ViewStateMaterialOptions = {
    textures: ViewStateTextures;
    instanceCount: number;
    materialCount: number;
    transparentPass: boolean;
};

export function createViewStateMaterial(options: ViewStateMaterialOptions): THREE.MeshStandardMaterial {
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.7,
        metalness: 0.1,
        transparent: options.transparentPass,
        depthWrite: !options.transparentPass,
        side: THREE.DoubleSide
    });

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uBaseMaterialTex = { value: options.textures.baseMaterial };
        shader.uniforms.uViewFlagsTex = { value: options.textures.flags };
        shader.uniforms.uColorOverridesTex = { value: options.textures.colorOverrides };
        shader.uniforms.uInstanceCount = { value: Math.max(1, options.instanceCount) };
        shader.uniforms.uMaterialCount = { value: Math.max(1, options.materialCount) };
        shader.uniforms.uViewFlagsTexWidth = { value: Math.max(1, options.textures.flags.image.width) };
        shader.uniforms.uViewFlagsTexHeight = { value: Math.max(1, options.textures.flags.image.height) };
        shader.uniforms.uColorOverridesTexWidth = {
            value: Math.max(1, options.textures.colorOverrides.image.width)
        };
        shader.uniforms.uColorOverridesTexHeight = {
            value: Math.max(1, options.textures.colorOverrides.image.height)
        };
        shader.uniforms.uBaseMaterialTexWidth = {
            value: Math.max(1, options.textures.baseMaterial.image.width)
        };
        shader.uniforms.uBaseMaterialTexHeight = {
            value: Math.max(1, options.textures.baseMaterial.image.height)
        };

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>
attribute float instanceId;
attribute float materialId;
varying float vInstanceId;
varying float vMaterialId;`
            )
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
vInstanceId = instanceId;
vMaterialId = materialId;`
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>
uniform sampler2D uBaseMaterialTex;
uniform sampler2D uViewFlagsTex;
uniform sampler2D uColorOverridesTex;
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

vec3 finalBaseColor = baseMaterial.rgb;
float finalOpacity = baseMaterial.a;

if (colorOverride.a > 0.5) {
    finalBaseColor = colorOverride.rgb;
}

if (isGhosted) {
    finalOpacity = min(finalOpacity, 0.2);
}

if (isSelected) {
    finalBaseColor = mix(finalBaseColor, vec3(1.0, 0.8, 0.0), 0.65);
}

if (!isVisible) {
    discard;
}

vec4 diffuseColor = vec4(finalBaseColor, finalOpacity);`
            );
    };

    material.customProgramCacheKey = () =>
        `view-state-${options.transparentPass ? 'transparent' : 'opaque'}-v1`;

    return material;
}
