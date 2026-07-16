import { TRANSFORMER_PRIMITIVES_WGSL } from "./transformer-primitives.wgsl";

type PrimitiveEntryPoint = "affine_layer_norm" | "rms_norm_rope" | "swiglu" | "gated_residual" | "add_residual";
export type GpuBufferResource = GPUBuffer | GPUBufferBinding;

function resource(buffer: GpuBufferResource): GPUBufferBinding {
  return "buffer" in buffer ? buffer : { buffer };
}

export class TransformerPrimitives {
  private readonly pipelines = new Map<PrimitiveEntryPoint, GPUComputePipeline>();
  private readonly bindGroupLayout: GPUBindGroupLayout;

  constructor(private readonly device: GPUDevice) {
    const module = device.createShaderModule({ label: "bonsai-owned-transformer-primitives", code: TRANSFORMER_PRIMITIVES_WGSL });
    this.bindGroupLayout = device.createBindGroupLayout({
      label: "bonsai-owned-transformer-primitive-bindings",
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      ],
    });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [this.bindGroupLayout] });
    for (const entryPoint of ["affine_layer_norm", "rms_norm_rope", "swiglu", "gated_residual", "add_residual"] as const) {
      this.pipelines.set(entryPoint, device.createComputePipeline({
        label: `bonsai-owned-${entryPoint}`,
        layout,
        compute: { module, entryPoint },
      }));
    }
  }

  encode(
    entryPoint: PrimitiveEntryPoint,
    encoder: GPUCommandEncoder,
    input: GpuBufferResource,
    parameterA: GpuBufferResource,
    parameterB: GpuBufferResource,
    output: GpuBufferResource,
    dimensions: GPUBuffer,
    dispatch: [number, number?, number?],
  ): void {
    const pipeline = this.pipelines.get(entryPoint);
    if (!pipeline) throw new Error(`Transformer primitive is unavailable: ${entryPoint}`);
    const entries: GPUBindGroupEntry[] = [input, parameterA, parameterB, output]
      .map((buffer, binding) => ({ binding, resource: resource(buffer) }));
    entries.push({ binding: 4, resource: { buffer: dimensions } });
    const bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries,
    });
    const pass = encoder.beginComputePass({ label: `bonsai-owned-${entryPoint}` });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dispatch[0], dispatch[1] ?? 1, dispatch[2] ?? 1);
    pass.end();
  }
}
