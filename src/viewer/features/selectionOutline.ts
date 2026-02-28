import * as THREE from 'three';
import type { ViewStateRuntime } from '../../renderState/viewStateRuntime';
import type { Viewer } from '../viewer';

export type SelectionOutlineStyle = {
    color?: THREE.ColorRepresentation;
    thicknessPx?: number;
    opacity?: number;
};

export type SelectionOutlineFeatureOptions = SelectionOutlineStyle & {
    enabled?: boolean;
};

const MIN_THICKNESS_PX = 1;
const MAX_THICKNESS_PX = 6;

function clamp01(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

function clampThicknessPx(value: number): number {
    if (!Number.isFinite(value)) return MIN_THICKNESS_PX;
    return Math.max(MIN_THICKNESS_PX, Math.min(MAX_THICKNESS_PX, Math.round(value)));
}

export class SelectionOutlineFeature {
    private readonly viewer: Viewer;
    private readonly baseRender: () => void;
    private readonly selectionMaskMaterial: THREE.ShaderMaterial;
    private readonly overlayMaterial: THREE.ShaderMaterial;
    private readonly overlayScene: THREE.Scene;
    private readonly overlayCamera: THREE.OrthographicCamera;
    private readonly overlayQuad: THREE.Mesh;
    private readonly selectionMaskTarget: THREE.WebGLRenderTarget;
    private readonly tmpClearColor = new THREE.Color();
    private readonly size = new THREE.Vector2();
    private runtime: ViewStateRuntime | null = null;
    private enabled = false;
    private disposed = false;

    constructor(viewer: Viewer, options?: SelectionOutlineFeatureOptions) {
        this.viewer = viewer;

        const initialSize = this.viewer.viewport.getParentSize();
        this.selectionMaskTarget = new THREE.WebGLRenderTarget(
            Math.max(1, initialSize.x),
            Math.max(1, initialSize.y),
            {
                minFilter: THREE.NearestFilter,
                magFilter: THREE.NearestFilter,
                depthBuffer: true,
                stencilBuffer: false
            }
        );
        this.selectionMaskTarget.texture.name = 'SelectionMask';

        this.selectionMaskMaterial = new THREE.ShaderMaterial({
            depthTest: true,
            depthWrite: true,
            transparent: false,
            side: THREE.DoubleSide,
            uniforms: {
                uViewFlagsTex: { value: null as THREE.Texture | null },
                uViewFlagsTexWidth: { value: 1 },
                uViewFlagsTexHeight: { value: 1 }
            },
            vertexShader: `
attribute float instanceId;
varying float vInstanceId;
void main() {
    vInstanceId = instanceId;
    vec4 localPosition = vec4(position, 1.0);
    #ifdef USE_INSTANCING
    localPosition = instanceMatrix * localPosition;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * localPosition;
}
`,
            fragmentShader: `
uniform sampler2D uViewFlagsTex;
uniform float uViewFlagsTexWidth;
uniform float uViewFlagsTexHeight;
varying float vInstanceId;

vec4 sampleLookupPacked(sampler2D t, float id, float width, float height) {
    float ix = mod(id, width);
    float iy = floor(id / width);
    vec2 uv = vec2((ix + 0.5) / width, (iy + 0.5) / height);
    return texture2D(t, uv);
}

void main() {
    vec4 stateFlags = sampleLookupPacked(
        uViewFlagsTex,
        floor(vInstanceId + 0.5),
        uViewFlagsTexWidth,
        uViewFlagsTexHeight
    );
    float rawFlags = floor(stateFlags.r * 255.0 + 0.5);
    bool isSelected = mod(floor(rawFlags / 2.0), 2.0) >= 1.0;
    if (!isSelected) discard;
    gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
}
`
        });

        this.overlayMaterial = new THREE.ShaderMaterial({
            transparent: true,
            blending: THREE.NormalBlending,
            depthTest: false,
            depthWrite: false,
            uniforms: {
                uSelectionMask: { value: this.selectionMaskTarget.texture },
                uTexelSize: {
                    value: new THREE.Vector2(
                        1 / Math.max(1, initialSize.x),
                        1 / Math.max(1, initialSize.y)
                    )
                },
                uOutlineColor: { value: new THREE.Color(options?.color ?? '#00d4ff') },
                uOutlineOpacity: { value: clamp01(options?.opacity ?? 1) },
                uOutlineThicknessPx: {
                    value: clampThicknessPx(options?.thicknessPx ?? 2)
                }
            },
            vertexShader: `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,
            fragmentShader: `
uniform sampler2D uSelectionMask;
uniform vec2 uTexelSize;
uniform vec3 uOutlineColor;
uniform float uOutlineOpacity;
uniform float uOutlineThicknessPx;
varying vec2 vUv;

float sampleMask(vec2 uv) {
    return texture2D(uSelectionMask, uv).r;
}

void main() {
    float center = sampleMask(vUv);
    float radius = clamp(uOutlineThicknessPx, 1.0, 6.0);
    float dilated = 0.0;
    for (int dx = -6; dx <= 6; dx++) {
        for (int dy = -6; dy <= 6; dy++) {
            float fx = float(dx);
            float fy = float(dy);
            if (abs(fx) > radius || abs(fy) > radius) continue;
            vec2 offset = vec2(fx, fy) * uTexelSize;
            dilated = max(dilated, sampleMask(vUv + offset));
        }
    }
    float ring = max(0.0, dilated - center);
    float alpha = clamp(ring * uOutlineOpacity, 0.0, 1.0);
    gl_FragColor = vec4(uOutlineColor, alpha);
}
`
        });

        this.overlayScene = new THREE.Scene();
        this.overlayCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        this.overlayQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.overlayMaterial);
        this.overlayQuad.frustumCulled = false;
        this.overlayScene.add(this.overlayQuad);

        this.baseRender = this.viewer.renderer.render.bind(this.viewer.renderer);
        this.viewer.renderer.render = this.renderWithOutline;
        this.enabled = options?.enabled ?? false;
    }

    setEnabled(enabled: boolean): void {
        if (this.disposed) return;
        this.enabled = enabled;
        this.viewer.renderer.needsUpdate = true;
        this.viewer.requestRender();
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    setStyle(style: SelectionOutlineStyle): void {
        if (this.disposed || !style) return;
        if (style.color !== undefined) {
            (this.overlayMaterial.uniforms.uOutlineColor.value as THREE.Color).set(style.color);
        }
        if (style.opacity !== undefined) {
            this.overlayMaterial.uniforms.uOutlineOpacity.value = clamp01(style.opacity);
        }
        if (style.thicknessPx !== undefined) {
            this.overlayMaterial.uniforms.uOutlineThicknessPx.value = clampThicknessPx(
                style.thicknessPx
            );
        }
        this.viewer.renderer.needsUpdate = true;
        this.viewer.requestRender();
    }

    setViewStateRuntime(runtime: ViewStateRuntime | null): void {
        this.runtime = runtime;
        const flagsTexture = runtime?.model?.textures?.flags ?? null;
        this.selectionMaskMaterial.uniforms.uViewFlagsTex.value = flagsTexture;
        this.selectionMaskMaterial.uniforms.uViewFlagsTexWidth.value = Math.max(
            1,
            flagsTexture?.image?.width ?? 1
        );
        this.selectionMaskMaterial.uniforms.uViewFlagsTexHeight.value = Math.max(
            1,
            flagsTexture?.image?.height ?? 1
        );
        this.viewer.renderer.needsUpdate = true;
        this.viewer.requestRender();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.viewer.renderer.render = this.baseRender;
        this.selectionMaskTarget.dispose();
        this.selectionMaskMaterial.dispose();
        this.overlayMaterial.dispose();
        this.overlayQuad.geometry.dispose();
        this.overlayScene.clear();
    }

    private renderWithOutline = (): void => {
        if (this.disposed || !this.enabled || !this.runtime) {
            this.baseRender();
            return;
        }

        if (!this.viewer.renderer.needsUpdate && !this.viewer.camera.hasMoved) return;
        this.baseRender();
        this.ensureRenderTargetSize();
        this.renderSelectionMask();
        this.renderOverlay();
    };

    private ensureRenderTargetSize(): void {
        const next = this.viewer.viewport.getParentSize();
        const width = Math.max(1, next.x);
        const height = Math.max(1, next.y);
        if (width === this.size.x && height === this.size.y) return;
        this.size.set(width, height);
        this.selectionMaskTarget.setSize(width, height);
        this.overlayMaterial.uniforms.uTexelSize.value.set(1 / width, 1 / height);
    }

    private renderSelectionMask(): void {
        const renderer = this.viewer.renderer.renderer;
        const prevRenderTarget = renderer.getRenderTarget();
        const prevAutoClear = renderer.autoClear;
        const prevClearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(this.tmpClearColor);
        const prevBackground = this.viewer.scene.background;
        const prevOverrideMaterial = this.viewer.scene.overrideMaterial;

        renderer.setRenderTarget(this.selectionMaskTarget);
        renderer.autoClear = true;
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        this.viewer.scene.background = null;
        this.viewer.scene.overrideMaterial = this.selectionMaskMaterial;
        renderer.render(this.viewer.scene, this.viewer.camera.camPerspective.camera);

        this.viewer.scene.overrideMaterial = prevOverrideMaterial;
        this.viewer.scene.background = prevBackground;
        renderer.setRenderTarget(prevRenderTarget);
        renderer.autoClear = prevAutoClear;
        renderer.setClearColor(this.tmpClearColor, prevClearAlpha);
    }

    private renderOverlay(): void {
        const renderer = this.viewer.renderer.renderer;
        const prevRenderTarget = renderer.getRenderTarget();
        const prevAutoClear = renderer.autoClear;
        const prevClearAlpha = renderer.getClearAlpha();
        renderer.getClearColor(this.tmpClearColor);

        renderer.setRenderTarget(null);
        renderer.autoClear = false;
        renderer.render(this.overlayScene, this.overlayCamera);

        renderer.setRenderTarget(prevRenderTarget);
        renderer.autoClear = prevAutoClear;
        renderer.setClearColor(this.tmpClearColor, prevClearAlpha);
    }
}
