import { ONLINE_ATTENTION_WGSL } from "./online-attention.wgsl";

export interface AttentionShape {
  batch: number;
  heads: number;
  queryLength: number;
  keyLength: number;
  headDimensions: 128;
}

export class OnlineAttention {
  private readonly pipeline: GPUComputePipeline;

  constructor(private readonly device: GPUDevice) {
    const module = device.createShaderModule({ label: "bonsai-owned-online-attention", code: ONLINE_ATTENTION_WGSL });
    this.pipeline = device.createComputePipeline({
      label: "bonsai-owned-online-attention",
      layout: "auto",
      compute: { module, entryPoint: "main" },
    });
  }

  encode(
    encoder: GPUCommandEncoder,
    query: GPUBuffer,
    key: GPUBuffer,
    value: GPUBuffer,
    output: GPUBuffer,
    dimensions: GPUBuffer,
    shape: AttentionShape,
  ): void {
    if (shape.headDimensions !== 128) throw new Error("Owned online attention currently requires 128-wide heads");
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [query, key, value, output, dimensions].map((buffer, binding) => ({ binding, resource: { buffer } })),
    });
    const pass = encoder.beginComputePass({ label: "bonsai-owned-online-attention" });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(shape.queryLength, shape.heads, shape.batch);
    pass.end();
  }
}
