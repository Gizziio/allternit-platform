import { TENSOR_LAYOUT_WGSL } from "./tensor-layout.wgsl";

export interface TensorLayoutShape {
  rows: number;
  width: number;
  heads: number;
  mlpWidth: number;
  outputRows?: number;
}

type LayoutEntryPoint = "split_qkv_mlp" | "concat_attention_mlp" | "rows_to_heads" |
  "concat_head_sequences" | "heads_to_rows_slice";
type LayoutBuffer = GPUBuffer | GPUBufferBinding;

function binding(buffer: LayoutBuffer): GPUBufferBinding {
  return "buffer" in buffer ? buffer : { buffer };
}

export class TensorLayout {
  private readonly pipelines = new Map<LayoutEntryPoint, GPUComputePipeline>();
  private readonly bindGroupLayout: GPUBindGroupLayout;

  constructor(private readonly device: GPUDevice) {
    const module = device.createShaderModule({ label: "bonsai-owned-tensor-layout", code: TENSOR_LAYOUT_WGSL });
    this.bindGroupLayout = device.createBindGroupLayout({
      label: "bonsai-owned-tensor-layout-bindings",
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } },
      ],
    });
    const layout = device.createPipelineLayout({
      label: "bonsai-owned-tensor-layout-pipeline-layout",
      bindGroupLayouts: [this.bindGroupLayout],
    });
    for (const entryPoint of ["split_qkv_mlp", "concat_attention_mlp", "rows_to_heads",
      "concat_head_sequences", "heads_to_rows_slice"] as const) {
      this.pipelines.set(entryPoint, device.createComputePipeline({
        label: `bonsai-owned-${entryPoint}`,
        layout,
        compute: { module, entryPoint },
      }));
    }
  }

  encode(entryPoint: LayoutEntryPoint, encoder: GPUCommandEncoder, source: LayoutBuffer, secondary: LayoutBuffer,
    destination: LayoutBuffer, dimensions: GPUBuffer, shape: TensorLayoutShape): void {
    const pipeline = this.pipelines.get(entryPoint);
    if (!pipeline) throw new Error(`Tensor layout operation is unavailable: ${entryPoint}`);
    const bindGroup = this.device.createBindGroup({
      layout: this.bindGroupLayout,
      entries: [source, secondary, destination, dimensions].map((buffer, index) => ({ binding: index, resource: binding(buffer) })),
    });
    const elements = entryPoint === "split_qkv_mlp"
      ? shape.rows * (shape.width * 3 + shape.mlpWidth * 2)
      : entryPoint === "concat_attention_mlp"
        ? shape.rows * (shape.width + shape.mlpWidth)
        : entryPoint === "concat_head_sequences"
          ? (shape.rows + shape.mlpWidth) * shape.width
          : entryPoint === "heads_to_rows_slice"
            ? (shape.outputRows ?? shape.rows) * shape.width
            : shape.rows * shape.width;
    const pass = encoder.beginComputePass({ label: `bonsai-owned-${entryPoint}` });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(elements / 256));
    pass.end();
  }
}
