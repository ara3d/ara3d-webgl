/// <reference path="./webgpuMultiDraw.d.ts" />

/** Chromium extension that provides multiDrawIndexedIndirect. */
export const MULTI_DRAW_FEATURE = 'chromium-experimental-multi-draw-indirect' as GPUFeatureName

/**
 * Lets an indirect command set a non-zero firstInstance, which is how each
 * draw finds its transform and color in the shared instance buffer.
 */
export const FIRST_INSTANCE_FEATURE = 'indirect-first-instance' as GPUFeatureName

/** A WebGPU device plus what we managed to enable on it. */
export type GpuContext = {
    adapter: GPUAdapter;
    device: GPUDevice;
    /** True when multiDrawIndexedIndirect can be called on a render pass. */
    multiDraw: boolean;
    /** Human readable description of the adapter. */
    adapterInfo: string;
    /** Resolves if the device is ever lost, which silently stops all rendering. */
    lost: Promise<GPUDeviceLostInfo>;
}

export function isWebGpuAvailable (): boolean {
  return typeof navigator !== 'undefined' && !!navigator.gpu
}

/**
 * Requests a device with the multi-draw feature when the browser offers it.
 * Falls back to a plain device (the renderer then loops over drawIndexedIndirect).
 */
export async function requestGpuContext (): Promise<GpuContext> {
  if (!isWebGpuAvailable()) { throw new Error('WebGPU is not available in this browser.') }

  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
  if (!adapter) { throw new Error('No WebGPU adapter found.') }

  if (!adapter.features.has(FIRST_INSTANCE_FEATURE)) {
    throw new Error(
      'This adapter does not support "indirect-first-instance", which indirect drawing needs here.')
  }

  const multiDraw = adapter.features.has(MULTI_DRAW_FEATURE)
  const requiredFeatures = [FIRST_INSTANCE_FEATURE]
  if (multiDraw) requiredFeatures.push(MULTI_DRAW_FEATURE)

  // Default limits cap buffers at 256 MiB; large models need more for
  // vertex and index buffers, so ask for whatever the adapter offers.
  const requiredLimits = {
    maxBufferSize: adapter.limits.maxBufferSize,
    maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize
  }

  const device = await adapter.requestDevice({ requiredFeatures, requiredLimits })
  device.addEventListener('uncapturederror', (e: any) => console.error('WebGPU:', e.error?.message))

  const lost = device.lost.then((info) => {
    console.error('WebGPU device lost:', info.reason, info.message)
    return info
  })

  return { adapter, device, multiDraw, adapterInfo: describeAdapter(adapter), lost }
}

function describeAdapter (adapter: GPUAdapter): string {
  const info = (adapter as any).info
  if (!info) return 'unknown adapter'
  return [info.vendor, info.architecture, info.device, info.description]
    .filter((s) => !!s)
    .join(' ')
}

/** Instructions to show when the extension is missing. */
export const MULTI_DRAW_HELP =
    'Launch Chrome or Edge with --enable-dawn-features=multi_draw_indirect ' +
    'and --enable-unsafe-webgpu.'
