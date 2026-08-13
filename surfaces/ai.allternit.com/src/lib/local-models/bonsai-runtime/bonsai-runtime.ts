import { GpuBufferArena } from "./gpu-buffer-arena";
import { gpuPixelsToPng, readGpuFloat32 } from "./gpu-readback";
import { BONSAI_TEXT_ENCODER } from "./model-spec";
import { OwnedBonsaiPipeline, type OwnedBonsaiGenerationOptions } from "./owned-pipeline";
import { QwenBpeTokenizer } from "./qwen-tokenizer";
import { BonsaiTextEncoderRunner } from "./text-encoder-runner";

export type BonsaiRuntimeStatus = "idle" | "loading" | "ready" | "generating" | "error";

export interface BonsaiRuntimeOptions {
  device?: GPUDevice;
  onStatusChange?: (status: BonsaiRuntimeStatus) => void;
}

export interface BonsaiTextGenerationOptions {
  prompt: string;
  maxLength?: number;
  temperature?: number;
  topK?: number;
  seed?: number;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
}

export interface BonsaiTextGenerationResult {
  text: string;
  tokenIds: number[];
  tokensGenerated: number;
  elapsedMs: number;
}

export interface BonsaiImageGenerationOptions {
  prompt: string;
  width?: number;
  height?: number;
  numInferenceSteps?: number;
  seed?: number;
  signal?: AbortSignal;
  onProgress?: (progress: { stage: string; completed: number; total: number }) => void;
}

export interface BonsaiDeviceInfo {
  available: boolean;
  adapterInfo?: GPUAdapterInfo;
  maxBufferSize?: number;
  maxStorageBufferBindingSize?: number;
}

export class BonsaiRuntime {
  private device?: GPUDevice;
  private pipeline?: OwnedBonsaiPipeline;
  private textEncoder?: BonsaiTextEncoderRunner;
  private tokenizer?: Promise<QwenBpeTokenizer>;
  private _status: BonsaiRuntimeStatus = "idle";
  private readonly onStatusChange?: (status: BonsaiRuntimeStatus) => void;

  constructor(options: BonsaiRuntimeOptions = {}) {
    this.onStatusChange = options.onStatusChange;
  }

  get status(): BonsaiRuntimeStatus {
    return this._status;
  }

  private setStatus(status: BonsaiRuntimeStatus): void {
    this._status = status;
    this.onStatusChange?.(status);
  }

  static async probeWebGpu(): Promise<BonsaiDeviceInfo> {
    if (typeof navigator === "undefined" || !navigator.gpu) {
      return { available: false };
    }
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return { available: false };
    const info = adapter.info;
    const limits = adapter.limits;
    return {
      available: true,
      adapterInfo: info,
      maxBufferSize: limits.maxBufferSize,
      maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
    };
  }

  async initialize(): Promise<void> {
    if (this._status === "ready") return;
    this.setStatus("loading");
    try {
      if (!navigator.gpu) throw new Error("WebGPU is unavailable");
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter) throw new Error("No WebGPU adapter is available");
      this.device = await adapter.requestDevice();
      this.device.lost.then(info => {
        if (info.reason !== "destroyed") console.warn("Bonsai WebGPU device lost:", info.message);
        this.setStatus("error");
      });
      this.textEncoder = new BonsaiTextEncoderRunner(this.device);
      this.setStatus("ready");
    } catch (error) {
      this.setStatus("error");
      throw error;
    }
  }

  async encodePrompt(prompt: string, options: { maxLength?: number; signal?: AbortSignal } = {}): Promise<{
    embeddings: GPUBuffer;
    sequence: number;
    validTokens: number;
    arena: GpuBufferArena;
  }> {
    this.ensureReady();
    return this.textEncoder!.encode(prompt, {
      maxLength: options.maxLength ?? 512,
      bucketed: true,
      signal: options.signal,
    });
  }

  async extractEmbeddings(prompt: string, options: { maxLength?: number; signal?: AbortSignal } = {}): Promise<Float32Array> {
    const result = await this.encodePrompt(prompt, options);
    try {
      const spec = BONSAI_TEXT_ENCODER;
      const contextDimensions = spec.hiddenDimensions * spec.outputLayers.length;
      return await readGpuFloat32(this.device!, result.embeddings, result.sequence * contextDimensions);
    } finally {
      result.arena.destroy();
    }
  }

  async generateImage(options: BonsaiImageGenerationOptions): Promise<Blob> {
    this.setStatus("generating");
    try {
      if (!this.pipeline) {
        if (!this.device) await this.initialize();
        this.pipeline = new OwnedBonsaiPipeline(this.device!);
      }
      const pipelineOptions: OwnedBonsaiGenerationOptions = {
        prompt: options.prompt,
        width: options.width ?? 512,
        height: options.height ?? 512,
        numInferenceSteps: options.numInferenceSteps ?? 4,
        seed: options.seed,
        signal: options.signal,
        onProgress: options.onProgress,
      };
      const blob = await this.pipeline.generate(pipelineOptions);
      this.setStatus("ready");
      return blob;
    } catch (error) {
      this.setStatus("error");
      throw error;
    }
  }

  async tokenize(text: string): Promise<{ ids: Uint32Array; validTokens: number }> {
    const tokenizer = await this.getTokenizer();
    return tokenizer.tokenizePrompt(text);
  }

  async detokenize(ids: number[] | Uint32Array): Promise<string> {
    const tokenizer = await this.getTokenizer();
    return tokenizer.decode(ids);
  }

  getTokenizer(): Promise<QwenBpeTokenizer> {
    return (this.tokenizer ??= QwenBpeTokenizer.fromPretrained().catch(error => {
      this.tokenizer = undefined;
      throw error;
    }));
  }

  dispose(): void {
    this.textEncoder?.clearCache();
    this.pipeline?.dispose();
    this.textEncoder = undefined;
    this.pipeline = undefined;
    this.tokenizer = undefined;
    this.device = undefined;
    this.setStatus("idle");
  }

  private ensureReady(): void {
    if (this._status !== "ready" || !this.device || !this.textEncoder) {
      throw new Error("BonsaiRuntime is not ready — call initialize() first");
    }
  }
}
