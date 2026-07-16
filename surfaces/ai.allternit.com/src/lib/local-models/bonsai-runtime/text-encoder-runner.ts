import { GpuBufferArena } from "./gpu-buffer-arena";
import { BONSAI_TEXT_ENCODER } from "./model-spec";
import { QwenKernels } from "./qwen-kernels";
import { QwenLayerExecutor } from "./qwen-layer-executor";
import { qwenRotaryEmbedding } from "./qwen-rope";
import { QwenBpeTokenizer } from "./qwen-tokenizer";
import { BonsaiTextEncoderReader, type LoadedQwenLayer } from "./text-encoder-loader";

export interface TextEncoderResult {
  embeddings: GPUBuffer;
  sequence: number;
  validTokens: number;
  arena: GpuBufferArena;
}

export class BonsaiTextEncoderRunner {
  private tokenizer?: Promise<QwenBpeTokenizer>;
  private readonly layers = new Map<number, Promise<LoadedQwenLayer>>();
  private readonly executor: QwenLayerExecutor;
  private readonly kernels: QwenKernels;

  constructor(private readonly device: GPUDevice, private readonly reader = new BonsaiTextEncoderReader()) {
    this.executor = new QwenLayerExecutor(device);
    this.kernels = new QwenKernels(device);
  }

  async encode(prompt: string, options: { maxLength?: number; bucketed?: boolean; signal?: AbortSignal;
    maxWorkingBytes?: number } = {}): Promise<TextEncoderResult> {
    const tokenizer = await (this.tokenizer ??= QwenBpeTokenizer.fromPretrained().catch(error => {
      this.tokenizer = undefined; throw error;
    }));
    const tokenized = tokenizer.tokenizePrompt(prompt, options.maxLength ?? 512, options.bucketed ?? true);
    options.signal?.throwIfAborted();
    const embeddingRows = await this.reader.loadEmbeddingRows(tokenized.ids, options.signal);
    const embedding = embeddingRows.matrix;
    const spec = BONSAI_TEXT_ENCODER;
    if (embedding.columns !== spec.hiddenDimensions) {
      throw new Error("Qwen embedding matrix shape mismatch");
    }
    const sequence = tokenized.ids.length;
    const initialArena = new GpuBufferArena(this.device);
    let currentArena: GpuBufferArena | undefined = initialArena;
    const captureArena = new GpuBufferArena(this.device);
    const ropeArena = new GpuBufferArena(this.device);
    try {
      const tokens = initialArena.upload(embeddingRows.tokenRows);
      const packed = initialArena.upload(embedding.packedWeights);
      const scales = initialArena.upload(embedding.scales);
      const biases = initialArena.upload(embedding.biases);
      let state = initialArena.create(sequence * spec.hiddenDimensions * 4, undefined, "bonsai-qwen-embedding-output");
      const embeddingShape = initialArena.uniform([sequence, spec.hiddenDimensions, spec.groupSize, spec.bits]);
      const embeddingEncoder = this.device.createCommandEncoder({ label: "bonsai-owned-qwen-embedding" });
      this.kernels.encodeEmbedding(embeddingEncoder, tokens, packed, scales, biases, state, embeddingShape,
        sequence * spec.hiddenDimensions);
      this.device.queue.submit([embeddingEncoder.finish()]);
      const rope = ropeArena.upload(qwenRotaryEmbedding(sequence), undefined, "bonsai-qwen-rope");
      const captures = spec.outputLayers.map(layer => captureArena.create(sequence * spec.hiddenDimensions * 4,
        undefined, `bonsai-qwen-layer-${layer}-capture`));
      const captureMap = new Map(spec.outputLayers.map((layer, index) => [layer - 1, captures[index]]));
      const lastLayer = spec.outputLayers[spec.outputLayers.length - 1];
      for (let index = 0; index < lastLayer; index += 1) {
        options.signal?.throwIfAborted();
        const layer = await this.loadLayer(index, options.signal);
        const execution = this.executor.encode(state, sequence, layer, rope, tokenized.validTokens,
          options.maxWorkingBytes);
        const capture = captureMap.get(index);
        if (capture) {
          const copy = this.device.createCommandEncoder({ label: `bonsai-owned-capture-qwen-${index + 1}` });
          copy.copyBufferToBuffer(execution.output, 0, capture, 0, sequence * spec.hiddenDimensions * 4);
          this.device.queue.submit([copy.finish()]);
        }
        await this.device.queue.onSubmittedWorkDone();
        this.layers.delete(index);
        currentArena.destroy();
        currentArena = execution.arena;
        state = execution.output;
      }
      const embeddings = captureArena.create(sequence * spec.hiddenDimensions * 3 * 4, undefined,
        "bonsai-qwen-prompt-embeddings");
      const concatShape = captureArena.uniform([sequence, spec.hiddenDimensions, 0, 0]);
      const concat = this.device.createCommandEncoder({ label: "bonsai-owned-concat-qwen-captures" });
      this.kernels.encodePrimitive("concat_three", concat, captures[0], captures[1], captures[2], embeddings,
        concatShape, [Math.ceil(sequence * spec.hiddenDimensions * 3 / 256)]);
      this.device.queue.submit([concat.finish()]);
      await this.device.queue.onSubmittedWorkDone();
      currentArena.destroy();
      currentArena = undefined;
      return { embeddings, sequence, validTokens: tokenized.validTokens, arena: captureArena };
    } catch (error) {
      currentArena?.destroy(); captureArena.destroy(); throw error;
    } finally { ropeArena.destroy(); }
  }

  clearCache(): void { this.layers.clear(); this.tokenizer = undefined; }
  releaseWeights(): void { this.layers.clear(); }

  private loadLayer(index: number, signal?: AbortSignal): Promise<LoadedQwenLayer> {
    let promise = this.layers.get(index);
    if (!promise) {
      promise = this.reader.loadLayer(index, signal).catch(error => { this.layers.delete(index); throw error; });
      this.layers.set(index, promise);
    }
    return promise;
  }
}
