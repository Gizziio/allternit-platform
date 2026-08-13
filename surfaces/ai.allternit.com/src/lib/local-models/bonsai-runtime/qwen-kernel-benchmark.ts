import { QwenKernels } from "./qwen-kernels";

export interface KernelBenchmarkResult {
  entryPoint: string;
  dispatches: number;
  elapsedMs: number;
  averageMs: number;
  gflops: number;
}

export interface KernelDiagnosticsResult {
  passed: boolean;
  tests: Array<{ name: string; ok: boolean; maxError: number }>;
}

export class QwenKernelBenchmark {
  constructor(private readonly device: GPUDevice) {}

  async benchmark(entryPoint: "rms_norm" | "rms_norm_rope" | "silu_multiply" | "concat_three",
    rows: number, width: number, iterations = 64): Promise<KernelBenchmarkResult> {
    const kernels = new QwenKernels(this.device);
    const elementCount = rows * width;
    const bytes = elementCount * 4;
    const input = this.device.createBuffer({ size: Math.max(4, bytes), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const parameterA = this.device.createBuffer({ size: Math.max(4, bytes), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const parameterB = this.device.createBuffer({ size: Math.max(4, bytes), usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const output = this.device.createBuffer({ size: Math.max(4, bytes), usage: GPUBufferUsage.STORAGE });
    const dimsBuffer = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(dimsBuffer, 0, new Uint32Array([rows, width, 0, floatBits(1e-6)]));

    const dispatch: [number] = [Math.ceil(elementCount / 256)];
    const encoder = this.device.createCommandEncoder({ label: `bonsai-kernel-bench-${entryPoint}` });
    for (let index = 0; index < iterations; index += 1) {
      kernels.encodePrimitive(entryPoint, encoder, input, parameterA, parameterB, output, dimsBuffer, dispatch);
    }
    const start = performance.now();
    this.device.queue.submit([encoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    const elapsedMs = performance.now() - start;
    const averageMs = elapsedMs / iterations;
    const gflops = (elementCount * 3 * iterations) / (elapsedMs * 1e6);

    input.destroy(); parameterA.destroy(); parameterB.destroy(); output.destroy(); dimsBuffer.destroy();

    return { entryPoint, dispatches: iterations, elapsedMs, averageMs, gflops };
  }

  async runDiagnostics(): Promise<KernelDiagnosticsResult> {
    const tests: KernelDiagnosticsResult["tests"] = [];
    const kernels = new QwenKernels(this.device);
    const rows = 4;
    const width = 256;
    const elementCount = rows * width;
    const bytes = elementCount * 4;
    const hostInput = new Float32Array(elementCount);
    for (let index = 0; index < elementCount; index += 1) hostInput[index] = (index % 7) - 3;
    const hostWeight = new Float32Array(elementCount).fill(1.0);

    const input = this.device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const weight = this.device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const output = this.device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC });
    const dims = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const readback = this.device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    this.device.queue.writeBuffer(input, 0, hostInput);
    this.device.queue.writeBuffer(weight, 0, hostWeight);
    this.device.queue.writeBuffer(dims, 0, new Uint32Array([rows, width, 0, floatBits(1e-6)]));

    const encoder = this.device.createCommandEncoder({ label: "bonsai-kernel-diagnostics" });
    kernels.encodePrimitive("rms_norm", encoder, input, weight, weight, output, dims, [rows]);
    encoder.copyBufferToBuffer(output, 0, readback, 0, bytes);
    this.device.queue.submit([encoder.finish()]);
    await readback.mapAsync(GPUMapMode.READ);
    const gpuOutput = new Float32Array(readback.getMappedRange().slice(0));
    readback.unmap();

    let maxError = 0;
    for (let row = 0; row < rows; row += 1) {
      let sumSq = 0;
      for (let col = 0; col < width; col += 1) {
        const value = hostInput[row * width + col];
        sumSq += value * value;
      }
      const rms = Math.sqrt(sumSq / width + 1e-6);
      for (let col = 0; col < width; col += 1) {
        const expected = hostInput[row * width + col] / rms;
        const actual = gpuOutput[row * width + col];
        maxError = Math.max(maxError, Math.abs(expected - actual));
      }
    }
    tests.push({ name: "rms_norm", ok: maxError < 1e-3, maxError });

    input.destroy(); weight.destroy(); output.destroy(); dims.destroy(); readback.destroy();

    return { passed: tests.every(test => test.ok), tests };
  }
}

function floatBits(value: number): number {
  const memory = new ArrayBuffer(4);
  new Float32Array(memory)[0] = value;
  return new Uint32Array(memory)[0];
}
