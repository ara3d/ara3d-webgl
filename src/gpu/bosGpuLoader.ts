import { GpuModel, GpuModelLoader } from './gpuModelLoader'

/** @deprecated Use {@link GpuModel}. */
export type BosGpuModel = GpuModel

/** @deprecated Use {@link GpuModelLoader}, which also reads `.bfast` models. */
export const BosGpuLoader = GpuModelLoader
