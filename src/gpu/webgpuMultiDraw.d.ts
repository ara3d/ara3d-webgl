/// <reference types="@webgpu/types" />

// Chromium's experimental multi-draw-indirect extension is not in @webgpu/types yet.
// See https://chromestatus.com/feature/5121353697788928

declare global {
  interface GPURenderPassEncoder {
    multiDrawIndirect(
      indirectBuffer: GPUBuffer,
      indirectOffset: number,
      maxDrawCount: number,
      drawCountBuffer?: GPUBuffer,
      drawCountBufferOffset?: number
    ): void;

    multiDrawIndexedIndirect(
      indirectBuffer: GPUBuffer,
      indirectOffset: number,
      maxDrawCount: number,
      drawCountBuffer?: GPUBuffer,
      drawCountBufferOffset?: number
    ): void;
  }
}

export {}
