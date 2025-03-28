/**
 @module viw-webgl-viewer
*/

import * as THREE from 'three'
import deepmerge from 'deepmerge'
import { floor } from '../images'
import { GizmoOptions } from './gizmos/gizmoAxes'
import { MaterialSettings } from '../materials/materials'

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

  materials: MaterialSettings

  /**
   * Axes gizmo options
   */
  axes: Partial<GizmoOptions>

  /**
   * Sunlight (directional light) options
   */
  sunLights: {
    position: THREE.Vector3
    color: THREE.Color
    intensity: number
  }[]

  rendering: {
    onDemand: boolean
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
  materials: {
    highlight: {
      color: new THREE.Color(0x6a, 0xd2, 0xff),
      opacity: 0.5
    },
    isolation: {
      color: new THREE.Color('#4E525C'),
      opacity: 0.08
    },
    section: {
      strokeWidth: 0.01,
      strokeFalloff: 0.75,
      strokeColor: new THREE.Color(0xf6, 0xf6, 0xf6)
    },
    outline: {
      intensity: 3,
      falloff: 3,
      blur: 2,
      color: new THREE.Color(0, 1, 1)
    }
  },
  axes: new GizmoOptions(),
  rendering: {
    onDemand: true
  }
}

export function getSettings (options?: PartialSettings) {
  return options
    ? (deepmerge(defaultConfig, options, undefined) as Settings)
    : (defaultConfig as Settings)
}
