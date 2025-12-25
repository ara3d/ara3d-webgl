import * as THREE from 'three'
import deepmerge from 'deepmerge'
import { floor } from '../images'

export type TextureEncoding = 'url' | 'base64' | undefined
export { GizmoOptions } from './gizmos/gizmoAxes'

/**
 * Makes all field optional recursively
 * https://stackoverflow.com/questions/41980195/recursive-partialt-in-typescript
 */
export type RecursivePartial<T> = {
  [P in keyof T]?: T[P] extends (infer U)[]
    ? RecursivePartial<U>[]
    : T[P] extends object
    ? RecursivePartial<T[P]>
    : T[P]
}

/** Viewer related options  */
export type Settings = {
  /**
   * Webgl canvas related options
   */
  canvas: {
    /** Canvas dom model id. If none provided a new canvas will be created */
    id: string | undefined
    /** Limits how often canvas will be resized if window is resized. */
    resizeDelay: number
  }
  /**
   * Three.js camera related options
   */
  camera: {
    /** Start with orthographic camera */
    orthographic: boolean

    /** Vector3 of 0 or 1 to enable/disable movement along each axis */
    allowedMovement: THREE.Vector3

    /** Vector2 of 0 or 1 to enable/disable rotation around x or y. */
    allowedRotation: THREE.Vector2

    /** Near clipping plane distance */
    near: number
    /** Far clipping plane distance */
    far: number
    /** Fov angle in degrees */
    fov: number
    /** Zoom level */
    zoom: number
    /** Initial forward of the camera */
    forward: THREE.Vector3

    /** Camera controls related options */
    controls: {
      /**
       * <p>Set true to start in orbit mode.</p>
       * <p>Camera has two modes: First person and orbit</p>
       * <p>First person allows to moves the camera around freely</p>
       * <p>Orbit rotates the camera around a focus point</p>
       */
      orbit: boolean
      /** Camera rotation speed factor */
      rotateSpeed: number
      orbitSpeed: number
      /** Camera movement speed factor */
      moveSpeed: number
    }
    /** Camera gizmo related options */
    gizmo: {
      enable: boolean
      size: number
      color: THREE.Color
      opacity: number
      opacityAlways: number
    }
  }
  /**
   * Rendering background options
   */
  background: {
    color: THREE.Color
  }
  /**
   * Plane under scene related options
   */
  groundPlane: {
    /** Enables/Disables plane under scene */
    visible: boolean
    encoding: TextureEncoding
    /** Local or remote texture url for plane */
    texture: string
    /** Opacity of the plane */
    opacity: number
    /** Color of the plane */
    color: THREE.Color
    /** Actual size is SceneRadius*size */
    size: number
  }
  /**
   * Skylight (hemisphere light) options
   */
  skylight: {
    skyColor: THREE.Color
    groundColor: THREE.Color
    intensity: number
  }

  /**
   * Sunlight (directional light) options
   */
  sunLights: {
    position: THREE.Vector3
    color: THREE.Color
    intensity: number
  }[]

  rendering: {
    onDemand: boolean,
       /**
     * Tone mapping mode for the renderer
     * ACESFilmicToneMapping is recommended for realistic results and wider dynamic range
     */
      toneMapping?: THREE.ToneMapping
      /**
      * Tone mapping exposure value
      */
      toneMappingExposure?: number
    }
}

export type PartialSettings = RecursivePartial<Settings>

const defaultConfig: Settings = {
  canvas: {
    id: undefined,
    resizeDelay: 200
  },
  camera: {
    orthographic: false,
    allowedMovement: new THREE.Vector3(1, 1, 1),
    allowedRotation: new THREE.Vector2(1, 1),
    near: 0.01,
    far: 15000,
    fov: 50,
    zoom: 1,
    // 45 deg down looking down z.
    forward: new THREE.Vector3(0, -0.707, 0.707),
    controls: {
      orbit: true,
      rotateSpeed: 1,
      orbitSpeed: 1,
      moveSpeed: 1
    },

    gizmo: {
      enable: true,
      size: 0.01,
      color: new THREE.Color(0xff, 0xff, 0xff),
      opacity: 0.5,
      opacityAlways: 0.125
    }
  },
  background: { color: new THREE.Color('#96999f') },
  groundPlane: {
    visible: true,
    encoding: 'base64',
    texture: floor,
    opacity: 1,
    color: new THREE.Color(0xff, 0xff, 0xff),
    size: 5
  },
  skylight: {
    skyColor: new THREE.Color().setHSL(0.6, 1, 0.6),
    groundColor: new THREE.Color().setHSL(0.095, 1, 0.75),
    intensity: 0.8
  },
  sunLights: [
    {
      position: new THREE.Vector3(-45.0, 40, -23),
      color: new THREE.Color().setHSL(0.1, 1, 0.95),
      intensity: 0.8
    },
    {
      position: new THREE.Vector3(45.0, 40, 23),
      color: new THREE.Color().setHSL(0.1, 1, 0.95),
      intensity: 0.2
    }
  ],
  rendering: {
    onDemand: true
  }
}


/**
 * Check if a value is a THREE.js class instance that should not be merged
 */
function isThreeClassInstance (value: unknown): boolean {
  return value instanceof THREE.Color ||
         value instanceof THREE.Vector3 ||
         value instanceof THREE.Vector2 ||
         value instanceof THREE.Quaternion ||
         value instanceof THREE.Euler ||
         value instanceof THREE.Matrix4
}

/**
 * Ensure a value is a proper THREE.Color instance.
 * deepmerge may convert Color instances to plain objects, so we restore them.
 */
function ensureColor (value: unknown): THREE.Color {
  if (value instanceof THREE.Color) {
    return value
  }
  // Handle plain objects that were Color instances before deepmerge
  if (value && typeof value === 'object' && 'r' in value && 'g' in value && 'b' in value) {
    const c = value as { r: number; g: number; b: number }
    return new THREE.Color(c.r, c.g, c.b)
  }
  // Fallback to white
  return new THREE.Color(1, 1, 1)
}

/**
 * Ensure a value is a proper THREE.Vector3 instance.
 */
function ensureVector3 (value: unknown): THREE.Vector3 {
  if (value instanceof THREE.Vector3) {
    return value
  }
  if (value && typeof value === 'object' && 'x' in value && 'y' in value && 'z' in value) {
    const v = value as { x: number; y: number; z: number }
    return new THREE.Vector3(v.x, v.y, v.z)
  }
  return new THREE.Vector3()
}

/**
 * Ensure a value is a proper THREE.Vector2 instance.
 */
function ensureVector2 (value: unknown): THREE.Vector2 {
  if (value instanceof THREE.Vector2) {
    return value
  }
  if (value && typeof value === 'object' && 'x' in value && 'y' in value) {
    const v = value as { x: number; y: number }
    return new THREE.Vector2(v.x, v.y)
  }
  return new THREE.Vector2()
}

/**
 * Restore THREE class instances that deepmerge may have converted to plain objects
 */
function restoreThreeInstances (settings: Settings): Settings {
  // Camera
  settings.camera.allowedMovement = ensureVector3(settings.camera.allowedMovement)
  settings.camera.allowedRotation = ensureVector2(settings.camera.allowedRotation)
  settings.camera.forward = ensureVector3(settings.camera.forward)
  settings.camera.gizmo.color = ensureColor(settings.camera.gizmo.color)

  // Background - preserve null for transparent backgrounds
  if (settings.background.color !== null && settings.background.color !== undefined) {
    settings.background.color = ensureColor(settings.background.color)
  }

  // Ground plane
  settings.groundPlane.color = ensureColor(settings.groundPlane.color)

  // Skylight
  settings.skylight.skyColor = ensureColor(settings.skylight.skyColor)
  settings.skylight.groundColor = ensureColor(settings.skylight.groundColor)

  // Sunlights
  settings.sunLights = settings.sunLights.map(light => ({
    ...light,
    position: ensureVector3(light.position),
    color: ensureColor(light.color)
  }))

  return settings
}

export function getSettings (options?: PartialSettings) {
  if (!options) {
    return defaultConfig as Settings
  }

  // Use deepmerge with custom options to better handle THREE class instances
  const merged = deepmerge(defaultConfig, options, {
    // Don't merge THREE class instances - prefer the source value
    isMergeableObject: (value) => {
      if (isThreeClassInstance(value)) {
        return false
      }
      // Default behavior: merge plain objects
      return value !== null && typeof value === 'object' && !Array.isArray(value)
    }
  }) as Settings

  // Restore any THREE instances that may have been converted to plain objects
  return restoreThreeInstances(merged)
}
