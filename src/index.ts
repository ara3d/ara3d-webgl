// Links files to generate package type exports
export * as THREE from 'three'
export * as Format from 'vim-format'

export * from './viewer/viewer'
export * from './vim-loader/geometry'
export * from './viewer/gizmos/gizmoGrid'
export type { PointerMode, InputScheme } from './viewer/inputs/input'
export { DefaultInputScheme, KEYS } from './viewer/inputs/input'
export * from './viewer/viewerSettings'
export {
  RaycastResult as HitTestResult,
  InputAction
} from './viewer/raycaster'

export * from './vim-loader/geometry'
export * from './vim-loader/vimLoader'
export * from './materials/materials'
export * from './vim-loader/meshBuilder'
export * from './vim-loader/object'
export * from './vim-loader/scene'
export * from './vim-loader/vim'
