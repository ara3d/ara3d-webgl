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
        this.start();
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.clock.start();
        this.animate();
    }

    stop() {
        this.running = false;
        if (this.updateId !== null) {
            cancelAnimationFrame(this.updateId);
            this.updateId = null;
        }
    }

    private animate = () => {
        if (!this.running) return;
        this.updateId = requestAnimationFrame(this.animate);
        const dt = this.clock.getDelta();
        const camChanged = this.camera.update(dt);
        this.renderer.needsUpdate = this.renderer.needsUpdate || camChanged;
        this.renderer.render();
    };

    add(obj: THREE.Object3D, frameCamera = true) {
        console.log('Adding object');
        this.renderer.needsUpdate = true;
        if (!this.renderer.add(obj)) {
            throw new Error('Could not load object');
        }
    }

    remove(obj: THREE.Object3D) {
        console.log('Removing object');
        this.renderer.needsUpdate = true;
        this.renderer.remove(obj);
    }

    clear() {
        this.renderer.clear();
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
