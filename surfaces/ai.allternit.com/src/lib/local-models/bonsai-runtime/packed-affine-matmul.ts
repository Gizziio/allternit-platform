import { PACKED_AFFINE_MATMUL_WGSL } from "./packed-affine-matmul.wgsl";

export interface PackedAffineMatrix {
  rows: number;
  columns: number;
  groupSize: number;
  bits?: 2 | 4;
  packedWeights: Uint32Array;
  scales: Float32Array;
  biases: Float32Array;
}

export interface PackedAffineShape {
  batchRows: number;
  outputColumns: number;
  inner: number;
  groupSize: number;
  bits: 2 | 4;
}

export type PackedAffineBuffer = GPUBuffer | GPUBufferBinding;

function binding(buffer: PackedAffineBuffer): GPUBufferBinding {
  return "buffer" in buffer ? buffer : { buffer };
}

function storageBuffer(device: GPUDevice, data: ArrayBufferView, usage = GPUBufferUsage.STORAGE): GPUBuffer {
  const buffer = device.createBuffer({
    size: Math.max(4, Math.ceil(data.byteLength / 4) * 4),
    usage: usage | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(buffer, 0, data.buffer, data.byteOffset, data.byteLength);
  return buffer;
}

export class PackedAffineMatmul {
  private readonly pipeline: GPUComputePipeline;

  constructor(private readonly device: GPUDevice) {
    const module = device.createShaderModule({ label: "bonsai-owned-packed-affine-matmul", code: PACKED_AFFINE_MATMUL_WGSL });
    this.pipeline = device.createComputePipeline({
      label: "bonsai-owned-packed-affine-matmul",
      layout: "auto",
      compute: { module, entryPoint: "main" },
    });
  }

  encode(
    encoder: GPUCommandEncoder,
    input: PackedAffineBuffer,
    packedWeights: PackedAffineBuffer,
    scales: PackedAffineBuffer,
    biases: PackedAffineBuffer,
    output: PackedAffineBuffer,
    dimensions: GPUBuffer,
    shape: PackedAffineShape,
  ): void {
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [input, packedWeights, scales, biases, output, dimensions].map((buffer, index) => ({
        binding: index,
        resource: binding(buffer),
      })),
    });
    const pass = encoder.beginComputePass({ label: "bonsai-owned-packed-affine-matmul" });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(shape.outputColumns / 8), Math.ceil(shape.batchRows / 8));
    pass.end();
  }

  async run(input: Float32Array, batchRows: number, matrix: PackedAffineMatrix): Promise<Float32Array> {
    const { rows: outputColumns, columns: inner, groupSize } = matrix;
    const bits = matrix.bits ?? 2;
    if (input.length !== batchRows * inner) throw new Error("Packed affine matmul input shape mismatch");
    if (inner % groupSize !== 0) throw new Error("Reference kernel requires columns divisible by group size");
    const packedPerRow = Math.ceil(inner / (32 / bits));
    if (matrix.packedWeights.length !== outputColumns * packedPerRow) throw new Error("Packed weight shape mismatch");
    const groups = outputColumns * (inner / groupSize);
    if (matrix.scales.length !== groups || matrix.biases.length !== groups) throw new Error("Affine parameter shape mismatch");

    const inputBuffer = storageBuffer(this.device, input);
    const weightBuffer = storageBuffer(this.device, matrix.packedWeights);
    const scaleBuffer = storageBuffer(this.device, matrix.scales);
    const biasBuffer = storageBuffer(this.device, matrix.biases);
    const outputBytes = batchRows * outputColumns * 4;
    const outputBuffer = this.device.createBuffer({ size: outputBytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const readBuffer = this.device.createBuffer({ size: outputBytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const dimensions = new Uint32Array([batchRows, outputColumns, inner, groupSize, bits]);
    const dimensionsBuffer = storageBuffer(this.device, dimensions, GPUBufferUsage.UNIFORM);
    const buffers = [inputBuffer, weightBuffer, scaleBuffer, biasBuffer, outputBuffer, readBuffer, dimensionsBuffer];

    try {
      const encoder = this.device.createCommandEncoder();
      this.encode(encoder, inputBuffer, weightBuffer, scaleBuffer, biasBuffer, outputBuffer, dimensionsBuffer, {
        batchRows, outputColumns, inner, groupSize, bits,
      });
      encoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, outputBytes);
      this.device.queue.submit([encoder.finish()]);
      await readBuffer.mapAsync(GPUMapMode.READ);
      return new Float32Array(readBuffer.getMappedRange().slice(0));
    } finally {
      if (readBuffer.mapState === "mapped") readBuffer.unmap();
      for (const buffer of buffers) buffer.destroy();
    }
  }
}
