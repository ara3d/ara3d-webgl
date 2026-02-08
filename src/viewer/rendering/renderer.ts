import * as THREE from 'three';
import { Viewport } from '../viewport';
import { Camera } from '../camera/camera';
import { Settings } from '../viewerSettings';

export class Renderer {
    renderer: THREE.WebGLRenderer;
    antialias: boolean = true;
    scene: THREE.Scene;
    viewport: Viewport;
    camera: Camera;
    needsUpdate: boolean;

    constructor(
        scene: THREE.Scene,
        viewport: Viewport,
        camera: Camera,
        settings: Settings
    ) {
        this.viewport = viewport;
        this.scene = scene;
        this.camera = camera;

        // Higher performance trades quality for performance
        const highPerformance = false;

        this.renderer = highPerformance
            ? new THREE.WebGLRenderer({
                  canvas: viewport.canvas,
                  antialias: false,
                  precision: 'lowp',
                  alpha: true,
                  stencil: false,
                  powerPreference: 'high-performance',
                  logarithmicDepthBuffer: false,
              })
            : new THREE.WebGLRenderer({
                  canvas: viewport.canvas,
                  antialias: true,
                  precision: 'highp',
                  alpha: true,
                  stencil: false,
                  powerPreference: 'high-performance',
                  logarithmicDepthBuffer: true,
              });

        this.fitViewport();
        this.viewport.onResize.subscribe(() => this.fitViewport());
        this.camera.onValueChanged.sub(() => {
            this.needsUpdate = true;
        });
        this.background = settings.background.color;
    }

    dispose() {
        this.clear();
        this.renderer.clear();
        this.renderer.forceContextLoss();
        this.renderer.dispose();
    }

    get background() {
        return this.scene.background;
    }

    set background(color: THREE.Color | THREE.Texture) {
        this.scene.background = color;
        this.needsUpdate = true;
    }

    // Render only when the scene/camera is marked dirty, then reset the flag.
    render() {
        if (!this.needsUpdate && !this.camera.hasMoved) return;
        this.renderer.render(this.scene, this.camera.camPerspective.camera);
        this.needsUpdate = false;
    }

    add(target: THREE.Object3D) {
        this.scene.add(target);
        this.needsUpdate = true;
        return true;
    }

    remove(target: THREE.Object3D) {
        this.scene.remove(target);
        this.needsUpdate = true;
    }

    clear() {
        this.scene.clear();
        this.needsUpdate = true;
    }

    private _lastSize = new THREE.Vector2();

    // Resize renderer output; invalidates the scene to re-render at new size.
    private fitViewport = () => {
        const size = this.viewport.getParentSize();

        // avoid thrashing if you get multiple resize events with the same values.
        if (size.x === this._lastSize.x && size.y === this._lastSize.y) {
            return;
        }
        this._lastSize.copy(size);

        // TEMP: optimization
        const maxPixelRatio = 1.5;
        this.renderer.setPixelRatio(
            Math.min(window.devicePixelRatio, maxPixelRatio)
        );
        //this.renderer.setPixelRatio(window.devicePixelRatio)

        this.renderer.setSize(size.x, size.y);
        this.needsUpdate = true;
    };
}
