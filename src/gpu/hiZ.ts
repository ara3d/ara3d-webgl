import { hiZDownsampleShader, hiZResolveShader } from './shaders/hiZShader'

const WORKGROUP = 8

/**
 * A hierarchical depth pyramid built from the frame's depth buffer.
 * Mip 0 matches the depth buffer size and every level stores the farthest
 * depth of the 2x2 below it, so the cull shader can test a whole screen
 * rectangle with a handful of texel loads.
 *
 * The pyramid a frame reads was built at the end of the previous frame, so
 * `isValid` is false until the first build and after every `configure` or
 * `invalidate`, and the occlusion test is skipped for that frame.
 */
export class HiZPyramid {
  private readonly device: GPUDevice
  private readonly downPipeline: GPUComputePipeline
  private readonly resolvePipelines = new Map<number, GPUComputePipeline>()

  private texture: GPUTexture | undefined
  private fullView: GPUTextureView | undefined
  private resolveBind: GPUBindGroup | undefined
  private downBinds: GPUBindGroup[] = []
  private mipSizes: [number, number][] = []
  private valid = false

  constructor (device: GPUDevice) {
    this.device = device
    this.downPipeline = device.createComputePipeline({
      label: 'hiZ downsample',
      layout: 'auto',
      compute: {
        module: device.createShaderModule({ label: 'hiZ downsample', code: hiZDownsampleShader }),
        entryPoint: 'main'
      }
    })
  }

  /** The full mip chain, for the cull shader. Present after `configure`. */
  get view (): GPUTextureView | undefined { return this.fullView }
  get width (): number { return this.mipSizes[0]?.[0] ?? 0 }
  get height (): number { return this.mipSizes[0]?.[1] ?? 0 }

  /** True once a build has run for the current size and depth buffer. */
  get isValid (): boolean { return this.valid }

  /** What the cull pass binds, or undefined until a build has run. */
  get cullPyramid (): { view: GPUTextureView; width: number; height: number } | undefined {
    return this.valid && this.fullView
      ? { view: this.fullView, width: this.width, height: this.height }
      : undefined
  }

  /** Forgets the content, e.g. when the scene it depicts was replaced. */
  invalidate () { this.valid = false }

  /**
   * Points the pyramid at the depth buffer, recreating the texture and bind
   * groups. Call whenever the depth texture is recreated.
   */
  configure (depth: GPUTexture, samples: number) {
    const width = depth.width
    const height = depth.height
    const mips = Math.floor(Math.log2(Math.max(width, height))) + 1

    this.texture?.destroy()
    const texture = this.device.createTexture({
      label: 'hiZ pyramid',
      size: [width, height],
      format: 'r32float',
      mipLevelCount: mips,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING
    })
    this.texture = texture
    this.fullView = texture.createView()

    this.mipSizes = []
    for (let i = 0; i < mips; i++) {
      this.mipSizes.push([Math.max(1, width >> i), Math.max(1, height >> i)])
    }

    const mipView = (i: number) =>
      texture.createView({ baseMipLevel: i, mipLevelCount: 1 })

    this.resolveBind = this.device.createBindGroup({
      layout: this.resolvePipeline(samples).getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: depth.createView() },
        { binding: 1, resource: mipView(0) }
      ]
    })
    this.downBinds = []
    for (let i = 0; i + 1 < mips; i++) {
      this.downBinds.push(this.device.createBindGroup({
        layout: this.downPipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: mipView(i) },
          { binding: 1, resource: mipView(i + 1) }
        ]
      }))
    }

    this.samples = samples
    this.valid = false
  }

  private samples = 0

  /** One pipeline per depth sample count, kept across reconfigures. */
  private resolvePipeline (samples: number): GPUComputePipeline {
    const cached = this.resolvePipelines.get(samples)
    if (cached) return cached
    const pipeline = this.device.createComputePipeline({
      label: 'hiZ resolve',
      layout: 'auto',
      compute: {
        module: this.device.createShaderModule({
          label: 'hiZ resolve',
          code: hiZResolveShader(samples)
        }),
        entryPoint: 'main'
      }
    })
    this.resolvePipelines.set(samples, pipeline)
    return pipeline
  }

  /**
   * Records the resolve and downsample passes. Call after the render pass
   * that wrote the depth buffer, in the same encoder.
   */
  build (encoder: GPUCommandEncoder) {
    if (!this.resolveBind) return
    const pass = encoder.beginComputePass({ label: 'hiZ' })

    const dispatch = (w: number, h: number) =>
      pass.dispatchWorkgroups(Math.ceil(w / WORKGROUP), Math.ceil(h / WORKGROUP))

    pass.setPipeline(this.resolvePipeline(this.samples))
    pass.setBindGroup(0, this.resolveBind)
    dispatch(this.mipSizes[0][0], this.mipSizes[0][1])

    pass.setPipeline(this.downPipeline)
    for (let i = 0; i < this.downBinds.length; i++) {
      pass.setBindGroup(0, this.downBinds[i])
      dispatch(this.mipSizes[i + 1][0], this.mipSizes[i + 1][1])
    }

    pass.end()
    this.valid = true
  }

  dispose () {
    this.texture?.destroy()
    this.texture = undefined
    this.valid = false
  }
}
