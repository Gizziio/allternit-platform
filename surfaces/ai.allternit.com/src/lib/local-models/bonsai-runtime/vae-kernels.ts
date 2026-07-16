import { VAE_ATTENTION_WGSL, VAE_CONVOLUTION_WGSL, VAE_NORMALIZATION_WGSL, VAE_UNPATCH_WGSL } from "./vae-kernels.wgsl";

export class VaeKernels {
  private readonly convolution: GPUComputePipeline;
  private readonly unpatch: GPUComputePipeline;
  private readonly attention: GPUComputePipeline;
  private readonly normLayout: GPUBindGroupLayout;
  private readonly normalization = new Map<"group_norm" | "add", GPUComputePipeline>();
  constructor(private readonly device: GPUDevice) {
    this.convolution = pipeline(device, VAE_CONVOLUTION_WGSL, "main", "bonsai-owned-vae-convolution");
    this.unpatch = pipeline(device, VAE_UNPATCH_WGSL, "main", "bonsai-owned-vae-unpatch");
    this.attention = pipeline(device, VAE_ATTENTION_WGSL, "main", "bonsai-owned-vae-attention");
    const module = device.createShaderModule({ code: VAE_NORMALIZATION_WGSL });
    this.normLayout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
    ] });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [this.normLayout] });
    for (const entryPoint of ["group_norm", "add"] as const) this.normalization.set(entryPoint,
      device.createComputePipeline({ layout, compute: { module, entryPoint } }));
  }
  encodeConvolution(encoder: GPUCommandEncoder, buffers: GPUBuffer[], outputWidth: number, outputHeight: number,
    outputChannels: number): void { encodeAuto(this.device, this.convolution, encoder, buffers,
      [Math.ceil(outputWidth / 8), Math.ceil(outputHeight / 8), outputChannels]); }
  encodeUnpatch(encoder: GPUCommandEncoder, buffers: GPUBuffer[], elements: number): void {
    encodeAuto(this.device, this.unpatch, encoder, buffers, [Math.ceil(elements / 256)]);
  }
  encodeAttention(encoder: GPUCommandEncoder, buffers: GPUBuffer[], sequence: number): void {
    encodeAuto(this.device, this.attention, encoder, buffers, [sequence]);
  }
  encodeNormalization(entryPoint: "group_norm" | "add", encoder: GPUCommandEncoder, buffers: GPUBuffer[],
    dispatch: [number, number]): void {
    const p = this.normalization.get(entryPoint)!;
    const group = this.device.createBindGroup({ layout: this.normLayout,
      entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const pass = encoder.beginComputePass(); pass.setPipeline(p); pass.setBindGroup(0, group);
    pass.dispatchWorkgroups(dispatch[0], dispatch[1]); pass.end();
  }
}
function pipeline(device: GPUDevice, code: string, entryPoint: string, label: string): GPUComputePipeline {
  return device.createComputePipeline({ label, layout: "auto", compute: { module: device.createShaderModule({ code }), entryPoint } });
}
function encodeAuto(device: GPUDevice, pipeline: GPUComputePipeline, encoder: GPUCommandEncoder, buffers: GPUBuffer[], dispatch: number[]): void {
  const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
    entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
  const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, group);
  pass.dispatchWorkgroups(dispatch[0], dispatch[1] ?? 1, dispatch[2] ?? 1); pass.end();
}

export function dispatch1D(elements: number): [number, number] {
  const groups = Math.ceil(elements / 256);
  if (groups <= 65535) return [groups, 1];
  const y = Math.ceil(groups / 65535);
  return [Math.ceil(groups / y), y];
}
