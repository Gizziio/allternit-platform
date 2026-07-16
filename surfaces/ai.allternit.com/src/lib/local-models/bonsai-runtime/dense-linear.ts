import type { LoadedDenseTensor } from "./packed-affine-loader";
import { DENSE_LINEAR_WGSL } from "./dense-linear.wgsl";

export class DenseLinear {
  private readonly pipeline: GPUComputePipeline;

  constructor(private readonly device: GPUDevice) {
    const module = device.createShaderModule({ label: "bonsai-owned-dense-linear", code: DENSE_LINEAR_WGSL });
    this.pipeline = device.createComputePipeline({
      label: "bonsai-owned-dense-linear", layout: "auto", compute: { module, entryPoint: "main" },
    });
  }

  encode(encoder: GPUCommandEncoder, input: GPUBuffer, weights: GPUBuffer, output: GPUBuffer,
    dimensions: GPUBuffer, rows: number, outputWidth: number): void {
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [input, weights, output, dimensions].map((buffer, binding) => ({ binding, resource: { buffer } })),
    });
    const pass = encoder.beginComputePass({ label: "bonsai-owned-dense-linear" });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(outputWidth / 8), Math.ceil(rows / 8));
    pass.end();
  }

  static validateWeight(weight: LoadedDenseTensor, outputWidth: number, inputWidth: number): void {
    if (weight.shape.length !== 2 || weight.shape[0] !== outputWidth || weight.shape[1] !== inputWidth) {
      throw new Error(`${weight.name} must have shape [${outputWidth}, ${inputWidth}]`);
    }
  }
}

