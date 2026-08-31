import * as THREE from 'three'
import { Camera } from '../camera/camera'
import { Settings } from '../viewerSettings'

/** Pointer modes supported by the camera controls. */
export type PointerMode = 'orbit' | 'look' | 'pan' | 'zoom' | 'rect';

/** The canvas the input handlers listen to, and its pixel size. */
export interface InputSurface {
    canvas: HTMLCanvasElement;
    getSize(): THREE.Vector2;
}

/** Pointer mode state and actions shared by the input handlers. */
export interface InputModes {
    pointerActive: PointerMode;
    pointerOverride: PointerMode | undefined;
    readonly pointerFallback: PointerMode;
    ContextMenu(position: THREE.Vector2 | undefined): void;
    KeyAction(key: number): boolean;
}

/**
 * Everything the mouse, keyboard and touch handlers need. Both the Three.js
 * viewer and the standalone camera controls component implement it, which is
 * what lets a single set of handlers drive either one.
 */
export interface InputHost {
    camera: Camera;
    viewport: InputSurface;
    settings: Settings;
    inputs: InputModes;
    requestRender(): void;
}
