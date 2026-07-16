import { createFlowMatchSchedule, flowMatchEulerStep } from "./flow-match-scheduler";
import { GpuBufferArena } from "./gpu-buffer-arena";
import { gpuPixelsToPng, readGpuFloat32 } from "./gpu-readback";
import { BonsaiTextEncoderRunner } from "./text-encoder-runner";
import { BonsaiTransformerRunner } from "./transformer-runner";
import { BonsaiVaeDecoder } from "./vae-decoder";

export interface OwnedBonsaiGenerationOptions {
  prompt: string;
  width?: number;
  height?: number;
  numInferenceSteps?: number;
  seed?: number;
  signal?: AbortSignal;
  onProgress?: (progress: { stage: string; completed: number; total: number }) => void;
}

export class OwnedBonsaiPipeline {
  private readonly textEncoder: BonsaiTextEncoderRunner;
  private readonly transformer: BonsaiTransformerRunner;
  private readonly vae: BonsaiVaeDecoder;

  constructor(private readonly device: GPUDevice) {
    this.textEncoder = new BonsaiTextEncoderRunner(device);
    this.transformer = new BonsaiTransformerRunner(device);
    this.vae = new BonsaiVaeDecoder(device);
  }

  static async create(): Promise<OwnedBonsaiPipeline> {
    if (!navigator.gpu) throw new Error("WebGPU is unavailable");
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new Error("No WebGPU adapter is available");
    const device = await adapter.requestDevice();
    return new OwnedBonsaiPipeline(device);
  }

  async generate(options: OwnedBonsaiGenerationOptions): Promise<Blob> {
    const width = options.width ?? 512, height = options.height ?? 512;
    const steps = options.numInferenceSteps ?? 4, seed = options.seed ?? 42;
    if (width > 1024 || height > 1024) {
      throw new Error("Owned Bonsai currently supports dimensions up to 1024px");
    }
    options.signal?.throwIfAborted();
    options.onProgress?.({ stage: "text-encoder", completed: 0, total: steps + 2 });
    const text = await this.textEncoder.encode(options.prompt, { signal: options.signal, bucketed: true });
    let textValues: Float32Array;
    try { textValues = await readGpuFloat32(this.device, text.embeddings, text.sequence * 7680); }
    finally { text.arena.destroy(); this.textEncoder.releaseWeights(); }
    const schedule = createFlowMatchSchedule(width, height, steps);
    let latents = seededNormal(schedule.imageSequenceLength * 128, seed);
    for (let step = 0; step < steps; step += 1) {
      options.signal?.throwIfAborted();
      options.onProgress?.({ stage: "transformer", completed: step + 1, total: steps + 2 });
      const forward = await this.transformer.forward({
        imageTokens: latents, textEmbeddings: textValues, width, height,
        timestep: schedule.timesteps[step] / 1000, signal: options.signal,
      });
      let prediction: Float32Array;
      try { prediction = await readGpuFloat32(this.device, forward.prediction, latents.length); }
      finally { forward.arena.destroy(); }
      latents = flowMatchEulerStep(latents, prediction, schedule.sigmas[step], schedule.sigmas[step + 1]);
    }
    options.onProgress?.({ stage: "vae", completed: steps + 1, total: steps + 2 });
    const latentArena = new GpuBufferArena(this.device);
    const latentBuffer = latentArena.upload(latents, undefined, "bonsai-final-packed-latents");
    let decoded: Awaited<ReturnType<BonsaiVaeDecoder["decode"]>>;
    try { decoded = await this.vae.decode(latentBuffer, width, height, options.signal); }
    finally { latentArena.destroy(); }
    try {
      const png = await gpuPixelsToPng(this.device, decoded.pixels, decoded.width, decoded.height);
      options.onProgress?.({ stage: "complete", completed: steps + 2, total: steps + 2 });
      return png;
    } finally { decoded.arena.destroy(); this.vae.clearCache(); }
  }

  dispose(): void {
    this.textEncoder.clearCache(); this.transformer.clearWeightCache(); this.vae.clearCache(); this.device.destroy();
  }
}

function seededNormal(length: number, seed: number): Float32Array {
  let state = (seed >>> 0) || 0x6d2b79f5;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 2) {
    const radius = Math.sqrt(-2 * Math.log(Math.max(Number.EPSILON, random())));
    const angle = 2 * Math.PI * random();
    output[index] = radius * Math.cos(angle);
    if (index + 1 < length) output[index + 1] = radius * Math.sin(angle);
  }
  return output;
}
