import * as THREE from 'three';

import { Settings, getSettings, PartialSettings } from './viewerSettings';
import { Camera } from './camera/camera';
import { Input } from './inputs/input';
import { Environment } from './environment';
import { GizmoOrbit } from './gizmos/gizmoOrbit';
import { Viewport } from './viewport';
import { Renderer } from './rendering/renderer';

export class Viewer {
    settings: Settings;
    renderer: Renderer;
    viewport: Viewport;
    inputs: Input;
    camera: Camera;
    environment: Environment;
    gizmoOrbit: GizmoOrbit;
    running = false;
    updateId: number | null = null;
    clock = new THREE.Clock();
    scene = new THREE.Scene();
    private _isIdle = true;

    constructor(options?: PartialSettings) {
        this.settings = getSettings(options);

        this.viewport = new Viewport(this.settings);
        this.camera = new Camera(this.viewport, this.settings);
        this.renderer = new Renderer(
            this.scene,
            this.viewport,
            this.camera,
            this.settings
        );

        this.inputs = new Input(this);

        if (this.settings.camera.gizmo.enable) {
            this.gizmoOrbit = new GizmoOrbit(
                this.renderer,
                this.camera,
                this.inputs,
                this.settings
            );
        }

        this.environment = new Environment(this.settings);
        this.environment.getObjects().forEach((o) => this.renderer.add(o));
        this.inputs.registerAll();
        this.camera.onMoved.subscribe(() => this.requestRender());
        this.camera.onValueChanged.sub(() => this.requestRender());
        this.viewport.onResize.subscribe(() => this.requestRender());
        this.start();
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.clock.start();
        this.requestRender();
    }

    stop() {
        this.running = false;
        if (this.updateId !== null) {
            cancelAnimationFrame(this.updateId);
            this.updateId = null;
        }
    }

    requestRender() {
        if (!this.running) return;
        if (this.updateId !== null) return;
        if (this._isIdle) {
            this.clock.getDelta();
            this._isIdle = false;
        }
        this.updateId = requestAnimationFrame(this.animate);
    }

    private animate = () => {
        if (!this.running) return;
        this.updateId = null;
        const dt = this.clock.getDelta();
        const camChanged = this.camera.update(dt);
        if (camChanged) {
            this.renderer.needsUpdate = true;
        }
        this.renderer.render();
        if (camChanged || this.renderer.needsUpdate) {
            this.requestRender();
        } else {
            this._isIdle = true;
        }
    };

    add(obj: THREE.Object3D, frameCamera = true) {
        console.log('Adding object');
        this.renderer.needsUpdate = true;
        this.requestRender();
        if (!this.renderer.add(obj)) {
            throw new Error('Could not load object');
        }
    }

    remove(obj: THREE.Object3D) {
        console.log('Removing object');
        this.renderer.needsUpdate = true;
        this.requestRender();
        this.renderer.remove(obj);
    }

    clear() {
        this.renderer.clear();
        this.requestRender();
    }

    dispose() {
        cancelAnimationFrame(this.updateId);
        this.environment.dispose();
        this.gizmoOrbit.dispose();
        this.viewport.dispose();
        this.renderer.dispose();
        this.inputs.unregisterAll();
    }
}
