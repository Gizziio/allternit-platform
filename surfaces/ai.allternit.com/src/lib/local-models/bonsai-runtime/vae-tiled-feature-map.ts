import { GpuBufferArena } from "./gpu-buffer-arena";
import type { LoadedDenseTensor } from "./packed-affine-loader";
import {
  VAE_TILED_ADD_WGSL,
  VAE_TILED_CONVOLUTION_WGSL,
  VAE_TILED_NORMALIZE_WGSL,
  VAE_TILED_STATS_WGSL,
} from "./vae-tiled-kernels.wgsl";

export interface VaeFeatureBand { buffer: GPUBuffer; startRow: number; rows: number }
export interface VaeTiledFeatureMap {
  bands: VaeFeatureBand[];
  height: number;
  width: number;
  channels: number;
  arena: GpuBufferArena;
}

const F32 = 4;
const TARGET_BAND_BYTES = 64 * 1024 * 1024;

export class VaeTiledFeatureOps {
  private readonly stats: GPUComputePipeline;
  private readonly normalize: GPUComputePipeline;
  private readonly convolution: GPUComputePipeline;
  private readonly addPipeline: GPUComputePipeline;

  constructor(private readonly device: GPUDevice) {
    this.stats = createPipeline(device, VAE_TILED_STATS_WGSL, "bonsai-vae-band-statistics");
    this.normalize = createPipeline(device, VAE_TILED_NORMALIZE_WGSL, "bonsai-vae-band-normalize");
    this.convolution = createPipeline(device, VAE_TILED_CONVOLUTION_WGSL, "bonsai-vae-band-convolution");
    this.addPipeline = createPipeline(device, VAE_TILED_ADD_WGSL, "bonsai-vae-band-add");
  }

  async fromBuffer(buffer: GPUBuffer, height: number, width: number, channels: number,
    rowsPerBand = maximumBandRows(width, channels)): Promise<VaeTiledFeatureMap> {
    const arena = new GpuBufferArena(this.device);
    const bands = createBands(arena, height, width, channels, Math.min(rowsPerBand, maximumBandRows(width, channels)));
    const encoder = this.device.createCommandEncoder({ label: "bonsai-vae-split-feature-bands" });
    for (const band of bands) encoder.copyBufferToBuffer(buffer, band.startRow * width * channels * F32,
      band.buffer, 0, band.rows * width * channels * F32);
    this.device.queue.submit([encoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    return { bands, height, width, channels, arena };
  }

  async retile(input: VaeTiledFeatureMap, rowsPerBand: number): Promise<VaeTiledFeatureMap> {
    const arena = new GpuBufferArena(this.device);
    const bands = createBands(arena, input.height, input.width, input.channels,
      Math.min(rowsPerBand, maximumBandRows(input.width, input.channels)));
    const rowBytes = input.width * input.channels * F32;
    const encoder = this.device.createCommandEncoder({ label: "bonsai-vae-retile-feature-bands" });
    for (const destination of bands) {
      const destinationEnd = destination.startRow + destination.rows;
      for (const source of input.bands) {
        const overlapStart = Math.max(destination.startRow, source.startRow);
        const overlapEnd = Math.min(destinationEnd, source.startRow + source.rows);
        if (overlapEnd <= overlapStart) continue;
        encoder.copyBufferToBuffer(source.buffer, (overlapStart - source.startRow) * rowBytes,
          destination.buffer, (overlapStart - destination.startRow) * rowBytes, (overlapEnd - overlapStart) * rowBytes);
      }
    }
    this.device.queue.submit([encoder.finish()]);
    await this.device.queue.onSubmittedWorkDone();
    return { ...input, bands, arena };
  }

  async groupNorm(input: VaeTiledFeatureMap, weight: LoadedDenseTensor, bias: LoadedDenseTensor,
    activate: boolean, groups = 32): Promise<VaeTiledFeatureMap> {
    if (input.channels % groups) throw new Error("VAE tiled GroupNorm channels must be divisible by groups");
    const sums = new Float64Array(groups), squares = new Float64Array(groups);
    for (const band of input.bands) {
      const partials = await this.bandStatistics(band, input.width, input.channels, groups);
      for (let group = 0; group < groups; group += 1) {
        sums[group] += partials[group];
        squares[group] += partials[groups + group];
      }
    }
    const count = input.height * input.width * (input.channels / groups);
    const statistics = new Float32Array(groups * 2);
    for (let group = 0; group < groups; group += 1) {
      const mean = sums[group] / count;
      statistics[group] = mean;
      statistics[groups + group] = 1 / Math.sqrt(Math.max(squares[group] / count - mean * mean, 0) + 1e-6);
    }
    const arena = new GpuBufferArena(this.device);
    const outputBands = createBandsLike(arena, input);
    const weights = arena.upload(weight.values), biases = arena.upload(bias.values), stats = arena.upload(statistics);
    for (let index = 0; index < input.bands.length; index += 1) {
      const source = input.bands[index], output = outputBands[index];
      const dims = arena.uniform([source.rows, input.width, input.channels, groups, activate ? 1 : 0]);
      const encoder = this.device.createCommandEncoder({ label: `bonsai-vae-normalize-band-${index}` });
      const count = source.rows * input.width * input.channels;
      encode(this.device, this.normalize, encoder, [source.buffer, weights, biases, stats, output.buffer, dims],
        dispatch1D(count));
      this.device.queue.submit([encoder.finish()]);
    }
    await this.device.queue.onSubmittedWorkDone();
    return { ...input, bands: outputBands, arena };
  }

  async convolve(input: VaeTiledFeatureMap, weight: LoadedDenseTensor, bias: LoadedDenseTensor,
    outputChannels: number, kernel = 3, upsample = false): Promise<VaeTiledFeatureMap> {
    if (kernel !== 1 && kernel !== 3) throw new Error("Tiled VAE convolution supports 1x1 or 3x3 kernels");
    const arena = new GpuBufferArena(this.device);
    const outputHeight = input.height * (upsample ? 2 : 1), outputWidth = input.width * (upsample ? 2 : 1);
    const outputBands = input.bands.map(band => ({
      startRow: band.startRow * (upsample ? 2 : 1), rows: band.rows * (upsample ? 2 : 1),
      buffer: arena.create(band.rows * (upsample ? 2 : 1) * outputWidth * outputChannels * F32),
    }));
    if (outputBands.some(band => band.rows * outputWidth * outputChannels * F32 >= 128 * 1024 * 1024)) {
      arena.destroy();
      throw new Error("Tiled VAE output band exceeds the 128 MiB binding budget; split the input into smaller bands");
    }
    const weights = arena.upload(weight.values), biases = arena.upload(bias.values);
    for (let index = 0; index < input.bands.length; index += 1) {
      const current = input.bands[index], previous = input.bands[index - 1] ?? current;
      const next = input.bands[index + 1] ?? current, output = outputBands[index];
      const dims = arena.uniform([
        input.height, input.width, input.channels, outputChannels, kernel, Math.floor(kernel / 2), upsample ? 1 : 0,
        current.startRow, current.rows, previous.startRow, previous.rows, next.startRow, next.rows,
        output.startRow, output.rows, 0,
      ]);
      const encoder = this.device.createCommandEncoder({ label: `bonsai-vae-convolution-band-${index}` });
      encode(this.device, this.convolution, encoder,
        [previous.buffer, current.buffer, next.buffer, weights, biases, output.buffer, dims],
        [Math.ceil(outputWidth / 8), Math.ceil(output.rows / 8), outputChannels]);
      this.device.queue.submit([encoder.finish()]);
    }
    await this.device.queue.onSubmittedWorkDone();
    return { bands: outputBands, height: outputHeight, width: outputWidth, channels: outputChannels, arena };
  }

  async add(left: VaeTiledFeatureMap, right: VaeTiledFeatureMap): Promise<VaeTiledFeatureMap> {
    requireSameLayout(left, right);
    const arena = new GpuBufferArena(this.device), bands = createBandsLike(arena, left);
    for (let index = 0; index < bands.length; index += 1) {
      const count = bands[index].rows * left.width * left.channels;
      const dims = arena.uniform([count]);
      const encoder = this.device.createCommandEncoder({ label: `bonsai-vae-add-band-${index}` });
      encode(this.device, this.addPipeline, encoder,
        [left.bands[index].buffer, right.bands[index].buffer, bands[index].buffer, dims], dispatch1D(count));
      this.device.queue.submit([encoder.finish()]);
    }
    await this.device.queue.onSubmittedWorkDone();
    return { ...left, bands, arena };
  }

  private async bandStatistics(band: VaeFeatureBand, width: number, channels: number, groups: number): Promise<Float32Array> {
    const bytes = groups * 2 * F32;
    const output = this.device.createBuffer({ size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const readback = this.device.createBuffer({ size: bytes, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const dims = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.device.queue.writeBuffer(dims, 0, new Uint32Array([band.rows, width, channels, groups]));
    try {
      const encoder = this.device.createCommandEncoder({ label: "bonsai-vae-band-statistics" });
      encode(this.device, this.stats, encoder, [band.buffer, output, dims], [groups]);
      encoder.copyBufferToBuffer(output, 0, readback, 0, bytes);
      this.device.queue.submit([encoder.finish()]);
      await readback.mapAsync(GPUMapMode.READ);
      return new Float32Array(readback.getMappedRange().slice(0));
    } finally {
      if (readback.mapState === "mapped") readback.unmap();
      output.destroy(); readback.destroy(); dims.destroy();
    }
  }
}

export function maximumBandRows(width: number, channels: number, targetBytes = TARGET_BAND_BYTES): number {
  return Math.max(1, Math.floor(Math.min(targetBytes, 128 * 1024 * 1024 - 256) / (width * channels * F32)));
}

function createBands(arena: GpuBufferArena, height: number, width: number, channels: number, rowsPerBand: number): VaeFeatureBand[] {
  const bands: VaeFeatureBand[] = [];
  for (let startRow = 0; startRow < height; startRow += rowsPerBand) {
    const rows = Math.min(rowsPerBand, height - startRow);
    bands.push({ startRow, rows, buffer: arena.create(rows * width * channels * F32) });
  }
  return bands;
}

function createBandsLike(arena: GpuBufferArena, input: VaeTiledFeatureMap): VaeFeatureBand[] {
  return input.bands.map(band => ({ ...band, buffer: arena.create(band.rows * input.width * input.channels * F32) }));
}

function requireSameLayout(left: VaeTiledFeatureMap, right: VaeTiledFeatureMap): void {
  if (left.height !== right.height || left.width !== right.width || left.channels !== right.channels ||
      left.bands.length !== right.bands.length || left.bands.some((band, index) =>
        band.startRow !== right.bands[index].startRow || band.rows !== right.bands[index].rows)) {
    throw new Error("Tiled VAE feature-map layouts do not match");
  }
}

function createPipeline(device: GPUDevice, code: string, label: string): GPUComputePipeline {
  return device.createComputePipeline({ label, layout: "auto", compute: { module: device.createShaderModule({ code }), entryPoint: "main" } });
}

export function dispatch1D(elements: number): [number, number, number] {
  const groups = Math.ceil(elements / 256);
  if (groups <= 65535) return [groups, 1, 1];
  const y = Math.ceil(groups / 65535);
  return [Math.ceil(groups / y), y, 1];
}

function encode(device: GPUDevice, pipeline: GPUComputePipeline, encoder: GPUCommandEncoder,
  buffers: GPUBuffer[], dispatch: [number, number?, number?]): void {
  const group = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0),
    entries: buffers.map((buffer, binding) => ({ binding, resource: { buffer } })) });
  const pass = encoder.beginComputePass();
  pass.setPipeline(pipeline); pass.setBindGroup(0, group);
  pass.dispatchWorkgroups(dispatch[0], dispatch[1] ?? 1, dispatch[2] ?? 1); pass.end();
}
