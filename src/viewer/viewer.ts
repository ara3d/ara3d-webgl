import * as THREE from 'three';

import { Settings, getSettings, PartialSettings } from './viewerSettings';
import { Camera } from './camera/camera';
import { Input } from './inputs/input';
import { Environment } from './environment';
import { GizmoOrbit } from './gizmos/gizmoOrbit';
import { Viewport } from './viewport';
import { Renderer } from './rendering/renderer';
import { perfDuration, perfLongTask, perfNow } from '../perf/perf';

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
        this.camera.onMoved.subscribe(() => this.requestRender());
        this.camera.onValueChanged.sub(() => this.requestRender());
        this.viewport.onResize.subscribe(() => this.requestRender());
        this.start();
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.requestRender();
    }

    stop() {
        this.running = false;
        if (this.updateId !== null) {
            cancelAnimationFrame(this.updateId);
            this.updateId = null;
        }
        this.clock.stop();
    }

    // Invalidation-driven render loop:
    // requestRender schedules a single frame; animate decides whether to keep
    // scheduling based on camera/scene changes and stops the clock when idle.
    requestRender() {
        const startedAt = perfNow();
        if (!this.running) return;
        if (this.updateId !== null) return;
        if (!this.clock.running) {
            this.clock.start();
            this.clock.getDelta();
        }
        this.updateId = requestAnimationFrame(this.animate);
        perfDuration('viewer.requestRender.schedule', startedAt, {
            hasPendingFrame: this.updateId !== null
        });
    }

    // Single-frame tick: update camera, render if needed, and reschedule if
    // camera/scene changes are still in progress (e.g. lerp or input).
    private animate = () => {
        const frameStartedAt = perfNow();
        if (!this.running) return;
        this.updateId = null;
        const cameraUpdateStartedAt = perfNow();
        const dt = this.clock.getDelta();
        const camChanged = this.camera.update(dt);
        const cameraUpdateDurationMs = perfDuration(
            'viewer.animate.cameraUpdate',
            cameraUpdateStartedAt,
            { dt }
        );
        if (camChanged) {
            this.renderer.needsUpdate = true;
        }
        const renderStartedAt = perfNow();
        this.renderer.render();
        const renderDurationMs = perfDuration('viewer.animate.rendererRender', renderStartedAt, {
            camChanged
        });
        if (camChanged || this.renderer.needsUpdate) {
            this.requestRender();
        } else {
            this.clock.stop();
        }
        perfLongTask('viewer.animate.longTask', frameStartedAt, 32, {
            camChanged,
            rendererNeedsUpdate: this.renderer.needsUpdate,
            cameraUpdateDurationMs,
            renderDurationMs
        });
    };

    // Mark scene dirty and schedule a render for new content.
    add(obj: THREE.Object3D, frameCamera = true) {
        const startedAt = perfNow();
        this.renderer.needsUpdate = true;
        this.requestRender();
        if (!this.renderer.add(obj)) {
            throw new Error('Could not load object');
        }
        perfDuration('viewer.add', startedAt, {
            childCount: this.scene.children.length,
            frameCamera
        });
    }

    remove(obj: THREE.Object3D) {
        const startedAt = perfNow();
        this.renderer.needsUpdate = true;
        this.requestRender();
        this.renderer.remove(obj);
        perfDuration('viewer.remove', startedAt, {
            childCount: this.scene.children.length
        });
    }

    // Clear scene content and ensure a render happens for the empty state.
    clear() {
        const startedAt = perfNow();
        this.renderer.clear();
        this.requestRender();
        perfDuration('viewer.clear', startedAt, {
            childCount: this.scene.children.length
        });
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
