/// <reference path="./webgpuMultiDraw.d.ts" />
import * as THREE from 'three'
import { GpuContext } from './gpuDevice'
import { createBuffer, toGpuBuffer } from './gpuBuffers'
import { sceneShader } from './shaders/sceneShader'
import { DRAW_COMMAND_WORDS, DrawRange, GpuScene, drawCount } from './gpuScene'
import { selectLargestDraws } from './fallbackDraws'
import { GpuVertices } from './gpuVertices'
import { GpuCuller, OPAQUE_COUNT_OFFSET, TRANSPARENT_COUNT_OFFSET } from './gpuCuller'

const CAMERA_BYTES = 96 // mat4 + eye vec4 + params vec4
const SAMPLE_COUNT = 4

/** The two pipelines a vertex layout needs, kept so scenes of one format share them. */
type ScenePipelines = {
    opaque: GPURenderPipeline;
    transparent: GPURenderPipeline;
}

type SceneResources = {
    scene: GpuScene;
    /** One buffer per vertex slot the scene's layout asks for. */
    vertexBuffers: GPUBuffer[];
    indices: GPUBuffer;
    instances: GPUBuffer;
    indirect: GPUBuffer;
    /** Present when the scene has too many commands for the one-call-per-draw path. */
    fallback?: { indirect: GPUBuffer; opaque: DrawRange; transparent: DrawRange };
    bindGroup: GPUBindGroup;
    culler: GpuCuller;
    pipelines: ScenePipelines;
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
  private readonly pipelineCache = new Map<string, ScenePipelines>()

  private resources: SceneResources | undefined
  private depth: GPUTexture | undefined
  private color: GPUTexture | undefined
  private width = 0
  private height = 0

  /** Set false to compare against the one-call-per-draw path. */
  useMultiDraw: boolean

  /**
   * Optional GPU frustum culling. Off by default: it only pays off on models
   * where much of the scene is off screen, and it needs the multi-draw
   * extension, because the surviving draw count stays on the GPU.
   */
  culling = false

  /**
   * Optional GPU contribution culling: instances whose bounding sphere projects
   * to less than `contributionThreshold` pixels across are skipped. It shares
   * the cull pass with frustum culling, so either flag runs the pass and the
   * two compose. Off by default, and it needs the multi-draw extension too.
   */
  contributionCulling = false

  /**
   * Minimum projected diameter in pixels. The default is deliberately tiny:
   * BIM models are full of small repeated elements, and dropping them at
   * different distances makes an object look wrong rather than just cheaper.
   */
  contributionThreshold = 0.1

  /**
   * Without the multi-draw extension every draw command costs a separate call
   * per frame, and millions of them can hang the GPU driver and freeze the
   * machine. On that path, a scene with more commands than this shows only
   * its largest instances. Read at {@link setScene}.
   */
  maxFallbackDraws = 50_000

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
  }

  /**
   * Pipelines depend on the scene's vertex layout, so they are built on first
   * use and reused by every later scene with the same layout.
   */
  private getPipelines (vertices: GpuVertices): ScenePipelines {
    const key = pipelineKey(vertices)
    const cached = this.pipelineCache.get(key)
    if (cached) return cached

    const module = this.ctx.device.createShaderModule({
      label: 'scene',
      code: sceneShader(vertices.format)
    })
    const pipelines = {
      opaque: this.createPipeline(module, vertices, false),
      transparent: this.createPipeline(module, vertices, true)
    }
    this.pipelineCache.set(key, pipelines)
    return pipelines
  }

  private createPipeline (
    module: GPUShaderModule,
    vertices: GpuVertices,
    transparent: boolean
  ): GPURenderPipeline {
    return this.ctx.device.createRenderPipeline({
      label: transparent ? 'transparent' : 'opaque',
      layout: this.ctx.device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
      vertex: {
        module,
        entryPoint: 'vs',
        buffers: vertexLayouts(vertices)
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

    // Streamed scenes arrive with their geometry already on the GPU; the
    // renderer takes ownership either way and frees it with the scene.
    const vertexBuffers = scene.vertices.buffers.map((b, i) =>
      toGpuBuffer(device, b.bytes, GPUBufferUsage.VERTEX, `vertices${i}`))
    const indices = toGpuBuffer(device, scene.indices, GPUBufferUsage.INDEX, 'indices')
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

    const culler = new GpuCuller(device, scene, indirect)

    this.resources = {
      scene,
      vertexBuffers,
      indices,
      instances,
      indirect,
      fallback: this.createFallback(scene),
      bindGroup,
      culler,
      pipelines: this.getPipelines(scene.vertices)
    }
    console.timeEnd('Uploading GPU buffers')
  }

  /** A reduced command buffer for the one-call-per-draw path, on scenes too big for it. */
  private createFallback (scene: GpuScene) {
    if (drawCount(scene) <= this.maxFallbackDraws) return undefined
    const draws = selectLargestDraws(scene, this.maxFallbackDraws)
    const indirect = createBuffer(
      this.ctx.device, draws.commands, GPUBufferUsage.INDIRECT, 'indirect fallback')
    return { indirect, opaque: draws.opaque, transparent: draws.transparent }
  }

  /** Number of draw commands in the current scene. */
  get drawCount (): number {
    return this.resources ? drawCount(this.resources.scene) : 0
  }

  /** True when the one-call-per-draw path is showing only the largest instances. */
  get fallbackActive (): boolean {
    return !!this.resources?.fallback && !(this.useMultiDraw && this.ctx.multiDraw)
  }

  /** True when either cull test is requested and the cull pass is usable. */
  get cullingActive (): boolean {
    return (this.culling || this.contributionCulling) && this.useMultiDraw && this.ctx.multiDraw
  }

  /** Commands actually submitted: after culling, or the fallback subset, or the whole scene. */
  get drawnCount (): number {
    if (!this.resources) return 0
    const fallback = this.fallbackActive ? this.resources.fallback : undefined
    if (fallback) return fallback.opaque.count + fallback.transparent.count
    if (!this.cullingActive) return this.drawCount
    const [opaque, transparent] = this.resources.culler.drawnCounts
    return opaque + transparent
  }

  render (viewProj: THREE.Matrix4, eye: THREE.Vector3) {
    const r = this.resources
    if (!r) return

    this.resize()
    this.updateCamera(viewProj, eye, r.scene.vertices.scale)

    const encoder = this.ctx.device.createCommandEncoder()
    const culler = this.cullingActive ? r.culler : undefined
    culler?.cull(encoder, viewProj, {
      frustum: this.culling,
      minPixels: this.contributionCulling ? this.contributionThreshold : 0,
      viewportHeight: Math.max(1, this.canvas.clientHeight)
    })

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
    r.vertexBuffers.forEach((b, i) => pass.setVertexBuffer(i, b))
    pass.setIndexBuffer(r.indices, 'uint32')

    const fallback = this.fallbackActive ? r.fallback : undefined
    const ranges = fallback ?? r.scene
    const indirect = culler ? culler.visible : fallback ? fallback.indirect : r.indirect

    pass.setPipeline(r.pipelines.opaque)
    this.drawRange(pass, indirect, ranges.opaque, culler?.counts, OPAQUE_COUNT_OFFSET)

    pass.setPipeline(r.pipelines.transparent)
    this.drawRange(pass, indirect, ranges.transparent, culler?.counts, TRANSPARENT_COUNT_OFFSET)

    pass.end()
    this.ctx.device.queue.submit([encoder.finish()])
    culler?.pollCounts()
  }

  private drawRange (
    pass: GPURenderPassEncoder,
    indirect: GPUBuffer,
    range: DrawRange,
    counts: GPUBuffer | undefined,
    countOffset: number
  ) {
    if (range.count === 0) return
    const stride = DRAW_COMMAND_WORDS * 4
    const offset = range.first * stride

    if (this.useMultiDraw && this.ctx.multiDraw) {
      // With a draw count buffer the CPU never learns how many instances the
      // cull pass kept; the GPU reads the counter written moments earlier.
      pass.multiDrawIndexedIndirect(indirect, offset, range.count, counts, countOffset)
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
    r.culler.dispose()
    const owned = [...r.vertexBuffers, r.indices, r.instances, r.indirect]
    if (r.fallback) owned.push(r.fallback.indirect)
    for (const b of owned) b.destroy()
    this.resources = undefined
  }

  dispose () {
    this.releaseScene()
    this.depth?.destroy()
    this.color?.destroy()
    this.cameraBuffer.destroy()
  }
}

/** Vertex buffer layouts matching the scene's description. */
const vertexLayouts = (v: GpuVertices): GPUVertexBufferLayout[] =>
  v.buffers.map((b) => ({
    arrayStride: b.stride,
    attributes: b.attributes.map((a) => ({ ...a, format: v.format as GPUVertexFormat }))
  }))

const pipelineKey = (v: GpuVertices) =>
  v.format + '|' + JSON.stringify(v.buffers.map((b) => [b.stride, b.attributes]))

const BLEND_OVER: GPUBlendState = {
  color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
  alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
}
