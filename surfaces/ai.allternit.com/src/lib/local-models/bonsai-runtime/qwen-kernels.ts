import { PACKED_EMBEDDING_WGSL, QWEN_CAUSAL_ATTENTION_WGSL, QWEN_KERNELS_WGSL } from "./qwen-kernels.wgsl";

export class QwenKernels {
  private readonly primitiveLayout: GPUBindGroupLayout;
  private readonly primitives = new Map<"rms_norm" | "rms_norm_rope" | "silu_multiply" | "concat_three", GPUComputePipeline>();
  private readonly attention: GPUComputePipeline;
  private readonly embedding: GPUComputePipeline;

  constructor(private readonly device: GPUDevice) {
    const module = device.createShaderModule({ label: "bonsai-owned-qwen-primitives", code: QWEN_KERNELS_WGSL });
    this.primitiveLayout = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
    ] });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [this.primitiveLayout] });
    for (const entryPoint of ["rms_norm", "rms_norm_rope", "silu_multiply", "concat_three"] as const) {
      this.primitives.set(entryPoint, device.createComputePipeline({ layout, compute: { module, entryPoint } }));
    }
    const attentionModule = device.createShaderModule({ label: "bonsai-owned-qwen-causal-attention", code: QWEN_CAUSAL_ATTENTION_WGSL });
    this.attention = device.createComputePipeline({ layout: "auto", compute: { module: attentionModule, entryPoint: "main" } });
    const embeddingModule = device.createShaderModule({ label: "bonsai-owned-packed-embedding", code: PACKED_EMBEDDING_WGSL });
    this.embedding = device.createComputePipeline({ layout: "auto", compute: { module: embeddingModule, entryPoint: "main" } });
  }

  encodePrimitive(entryPoint: "rms_norm" | "rms_norm_rope" | "silu_multiply" | "concat_three", encoder: GPUCommandEncoder,
    input: GPUBuffer, parameterA: GPUBuffer, parameterB: GPUBuffer, output: GPUBuffer, dimensions: GPUBuffer,
    dispatch: [number, number?, number?]): void {
    const pipeline = this.primitives.get(entryPoint)!;
    const bindGroup = this.device.createBindGroup({ layout: this.primitiveLayout,
      entries: [input, parameterA, parameterB, output, dimensions].map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const pass = encoder.beginComputePass({ label: `bonsai-owned-qwen-${entryPoint}` });
    pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatch[0], dispatch[1] ?? 1, dispatch[2] ?? 1); pass.end();
  }

  encodeAttention(encoder: GPUCommandEncoder, query: GPUBuffer, key: GPUBuffer, value: GPUBuffer,
    output: GPUBuffer, dimensions: GPUBuffer, sequence: number, heads: number): void {
    this.encodeAuto(this.attention, encoder, [query, key, value, output, dimensions], [sequence, heads]);
  }

  encodeEmbedding(encoder: GPUCommandEncoder, tokens: GPUBuffer, packed: GPUBuffer, scales: GPUBuffer,
    biases: GPUBuffer, output: GPUBuffer, dimensions: GPUBuffer, elements: number): void {
    this.encodeAuto(this.embedding, encoder, [tokens, packed, scales, biases, output, dimensions], [Math.ceil(elements / 256)]);
  }

  private encodeAuto(pipeline: GPUComputePipeline, encoder: GPUCommandEncoder, buffers: GPUBuffer[], dispatch: number[]): void {
    const bindGroup = this.device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
      entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
    const pass = encoder.beginComputePass(); pass.setPipeline(pipeline); pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatch[0], dispatch[1] ?? 1, dispatch[2] ?? 1); pass.end();
  }
}
