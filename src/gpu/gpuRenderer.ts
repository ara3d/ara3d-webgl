/// <reference path="./webgpuMultiDraw.d.ts" />
import * as THREE from 'three'
import { GpuContext } from './gpuDevice'
import { createBuffer } from './gpuBuffers'
import { sceneShader } from './shaders/sceneShader'
import { DRAW_COMMAND_WORDS, DrawRange, GpuScene, drawCount } from './gpuScene'

const CAMERA_BYTES = 96 // mat4 + eye vec4 + params vec4
const SAMPLE_COUNT = 4

type SceneResources = {
    scene: GpuScene;
    vertexX: GPUBuffer;
    vertexY: GPUBuffer;
    vertexZ: GPUBuffer;
    indices: GPUBuffer;
    instances: GPUBuffer;
    indirect: GPUBuffer;
    bindGroup: GPUBindGroup;
}

/**
 * Renders a whole BIM model with one indirect draw call per pipeline.
 * When the Chromium multi-draw extension is present, every draw command in a
 * range is issued by a single `multiDrawIndexedIndirect`; otherwise the same
 * command buffer is replayed with one `drawIndexedIndirect` per command.
 */
export class GpuRenderer {
  readonly canvas: HTMLCanvasElement
  readonly ctx: GpuContext

  private readonly context: GPUCanvasContext
  private readonly format: GPUTextureFormat
  private readonly cameraBuffer: GPUBuffer
  private readonly cameraData = new Float32Array(CAMERA_BYTES / 4)
  private readonly layout: GPUBindGroupLayout
  private readonly opaquePipeline: GPURenderPipeline
  private readonly transparentPipeline: GPURenderPipeline

  private resources: SceneResources | undefined
  private depth: GPUTexture | undefined
  private color: GPUTexture | undefined
  private width = 0
  private height = 0

  /** Set false to compare against the one-call-per-draw path. */
  useMultiDraw: boolean

  constructor (canvas: HTMLCanvasElement, ctx: GpuContext) {
    this.canvas = canvas
    this.ctx = ctx
    this.useMultiDraw = ctx.multiDraw

    const context = canvas.getContext('webgpu')
    if (!context) throw new Error('Could not create a WebGPU canvas context.')
    this.context = context
    this.format = navigator.gpu.getPreferredCanvasFormat()
    this.context.configure({ device: ctx.device, format: this.format, alphaMode: 'opaque' })

    this.cameraBuffer = ctx.device.createBuffer({
      label: 'camera',
      size: CAMERA_BYTES,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    })

    this.layout = ctx.device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'read-only-storage' }
        }
      ]
    })

    const module = ctx.device.createShaderModule({ label: 'scene', code: sceneShader })
    this.opaquePipeline = this.createPipeline(module, false)
    this.transparentPipeline = this.createPipeline(module, true)
  }

  private createPipeline (module: GPUShaderModule, transparent: boolean): GPURenderPipeline {
    const column = (shaderLocation: number): GPUVertexBufferLayout => ({
      arrayStride: 4,
      attributes: [{ shaderLocation, offset: 0, format: 'sint32' }]
    })

    return this.ctx.device.createRenderPipeline({
      label: transparent ? 'transparent' : 'opaque',
      layout: this.ctx.device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
      vertex: {
        module,
        entryPoint: 'vs',
        buffers: [column(0), column(1), column(2)]
      },
      fragment: {
        module,
        entryPoint: 'fs',
        targets: [{
          format: this.format,
          blend: transparent ? BLEND_OVER : undefined
        }]
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: !transparent,
        depthCompare: 'less'
      },
      multisample: { count: SAMPLE_COUNT }
    })
  }

  setScene (scene: GpuScene) {
    console.time('Uploading GPU buffers')
    const device = this.ctx.device
    this.releaseScene()

    const vertexX = createBuffer(device, scene.vertexX, GPUBufferUsage.VERTEX, 'vertexX')
    const vertexY = createBuffer(device, scene.vertexY, GPUBufferUsage.VERTEX, 'vertexY')
    const vertexZ = createBuffer(device, scene.vertexZ, GPUBufferUsage.VERTEX, 'vertexZ')
    const indices = createBuffer(device, scene.indices, GPUBufferUsage.INDEX, 'indices')
    const instances = createBuffer(device, scene.instanceData, GPUBufferUsage.STORAGE, 'instances')
    const indirect = createBuffer(
      device,
      scene.drawCommands,
      GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE,
      'indirect')

    const bindGroup = device.createBindGroup({
      layout: this.layout,
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: { buffer: instances } }
      ]
    })

    this.resources = { scene, vertexX, vertexY, vertexZ, indices, instances, indirect, bindGroup }
    console.timeEnd('Uploading GPU buffers')
  }

  /** Number of draw commands in the current scene. */
  get drawCount (): number {
    return this.resources ? drawCount(this.resources.scene) : 0
  }

  render (viewProj: THREE.Matrix4, eye: THREE.Vector3) {
    const r = this.resources
    if (!r) return

    this.resize()
    this.updateCamera(viewProj, eye, r.scene.vertexScale)

    const encoder = this.ctx.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.color.createView(),
        resolveTarget: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.09, g: 0.1, b: 0.12, a: 1 },
        loadOp: 'clear',
        storeOp: 'discard'
      }],
      depthStencilAttachment: {
        view: this.depth.createView(),
        depthClearValue: 1,
        depthLoadOp: 'clear',
        depthStoreOp: 'discard'
      }
    })

    pass.setBindGroup(0, r.bindGroup)
    pass.setVertexBuffer(0, r.vertexX)
    pass.setVertexBuffer(1, r.vertexY)
    pass.setVertexBuffer(2, r.vertexZ)
    pass.setIndexBuffer(r.indices, 'uint32')

    pass.setPipeline(this.opaquePipeline)
    this.drawRange(pass, r.indirect, r.scene.opaque)

    pass.setPipeline(this.transparentPipeline)
    this.drawRange(pass, r.indirect, r.scene.transparent)

    pass.end()
    this.ctx.device.queue.submit([encoder.finish()])
  }

  private drawRange (pass: GPURenderPassEncoder, indirect: GPUBuffer, range: DrawRange) {
    if (range.count === 0) return
    const stride = DRAW_COMMAND_WORDS * 4
    const offset = range.first * stride

    if (this.useMultiDraw && this.ctx.multiDraw) {
      pass.multiDrawIndexedIndirect(indirect, offset, range.count)
      return
    }

    for (let i = 0; i < range.count; i++) {
      pass.drawIndexedIndirect(indirect, offset + i * stride)
    }
  }

  private updateCamera (viewProj: THREE.Matrix4, eye: THREE.Vector3, vertexScale: number) {
    this.cameraData.set(viewProj.elements, 0)
    this.cameraData[16] = eye.x
    this.cameraData[17] = eye.y
    this.cameraData[18] = eye.z
    this.cameraData[20] = vertexScale
    this.ctx.device.queue.writeBuffer(this.cameraBuffer, 0, this.cameraData)
  }

  /** Matches the drawing buffer and render targets to the canvas' CSS size. */
  private resize () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr))
    const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr))
    if (width === this.width && height === this.height && this.depth) return

    this.width = width
    this.height = height
    this.canvas.width = width
    this.canvas.height = height

    this.depth?.destroy()
    this.color?.destroy()
    this.depth = this.ctx.device.createTexture({
      size: [width, height],
      format: 'depth24plus',
      sampleCount: SAMPLE_COUNT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    })
    this.color = this.ctx.device.createTexture({
      size: [width, height],
      format: this.format,
      sampleCount: SAMPLE_COUNT,
      usage: GPUTextureUsage.RENDER_ATTACHMENT
    })
  }

  get aspect (): number { return this.width / Math.max(this.height, 1) }

  private releaseScene () {
    const r = this.resources
    if (!r) return
    for (const b of [r.vertexX, r.vertexY, r.vertexZ, r.indices, r.instances, r.indirect]) {
      b.destroy()
    }
    this.resources = undefined
  }

  dispose () {
    this.releaseScene()
    this.depth?.destroy()
    this.color?.destroy()
    this.cameraBuffer.destroy()
  }
}

const BLEND_OVER: GPUBlendState = {
  color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
}
