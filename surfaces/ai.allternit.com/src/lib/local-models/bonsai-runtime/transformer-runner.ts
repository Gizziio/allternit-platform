import { BonsaiTransformerBlockLoader, type LoadedDoubleBlock, type LoadedSingleBlock } from "./block-loader";
import { BonsaiConditioningBuilder } from "./conditioning";
import { DenseLinear } from "./dense-linear";
import { DoubleBlockExecutor } from "./double-block-executor";
import { GpuBufferArena } from "./gpu-buffer-arena";
import { flux2ImageIds, flux2RotaryEmbedding, flux2TextIds, packRotaryEmbedding } from "./rope";
import { SingleBlockExecutor } from "./single-block-executor";
import { TransformerPrimitives } from "./transformer-primitives";
import { KLEIN_TRANSFORMER_SPEC } from "./transformer-spec";
import { BonsaiTransformerWeightLoader } from "./transformer-weight-loader";

export interface TransformerForwardInput {
  imageTokens: Float32Array;
  textEmbeddings: Float32Array;
  width: number;
  height: number;
  timestep: number;
  signal?: AbortSignal;
  maxWorkingBytes?: number;
}

export interface TransformerForwardResult {
  prediction: GPUBuffer;
  imageRows: number;
  channels: number;
  arena: GpuBufferArena;
}

export class BonsaiTransformerRunner {
  private readonly blockLoader: BonsaiTransformerBlockLoader;
  private readonly weights: BonsaiTransformerWeightLoader;
  private readonly conditioning: BonsaiConditioningBuilder;
  private readonly dense: DenseLinear;
  private readonly doubleExecutor: DoubleBlockExecutor;
  private readonly singleExecutor: SingleBlockExecutor;
  private readonly primitives: TransformerPrimitives;
  private readonly doubleBlocks = new Map<number, Promise<LoadedDoubleBlock>>();
  private readonly singleBlocks = new Map<number, Promise<LoadedSingleBlock>>();

  constructor(private readonly device: GPUDevice, blockLoader = new BonsaiTransformerBlockLoader(),
    weights = new BonsaiTransformerWeightLoader(blockLoader.reader)) {
    this.blockLoader = blockLoader;
    this.weights = weights;
    this.conditioning = new BonsaiConditioningBuilder(device);
    this.dense = new DenseLinear(device);
    this.doubleExecutor = new DoubleBlockExecutor(device);
    this.singleExecutor = new SingleBlockExecutor(device);
    this.primitives = new TransformerPrimitives(device);
  }

  async forward(input: TransformerForwardInput): Promise<TransformerForwardResult> {
    const spec = KLEIN_TRANSFORMER_SPEC;
    const imageRows = (input.width / 16) * (input.height / 16);
    if (!Number.isInteger(imageRows) || imageRows <= 0 || input.width % 32 || input.height % 32) {
      throw new Error("Transformer image dimensions must be positive multiples of 32");
    }
    if (input.imageTokens.length !== imageRows * spec.inputChannels) throw new Error("Image token shape mismatch");
    if (input.textEmbeddings.length % spec.contextDimensions) throw new Error("Text embedding shape mismatch");
    const textRows = input.textEmbeddings.length / spec.contextDimensions;
    if (!textRows) throw new Error("At least one text token is required");
    input.signal?.throwIfAborted();

    const [inputWeights, timestepWeights, firstDouble] = await Promise.all([
      this.weights.loadInput(input.signal), this.weights.loadTimestep(input.signal), this.loadDouble(0, input.signal),
    ]);
    input.signal?.throwIfAborted();
    const initialArena = new GpuBufferArena(this.device);
    let currentArena: GpuBufferArena | undefined = initialArena;
    let imageState: GPUBuffer;
    let textState: GPUBuffer;
    const ropeArena = new GpuBufferArena(this.device);
    const timestep = this.conditioning.prepareTimestep(input.timestep, timestepWeights);
    let doubleConditioning: Awaited<ReturnType<BonsaiConditioningBuilder["prepareDouble"]>> | undefined;
    let singleConditioning: ReturnType<BonsaiConditioningBuilder["prepareSingle"]> | undefined;
    let finalConditioning: ReturnType<BonsaiConditioningBuilder["prepareFinal"]> | undefined;
    let pendingOutputArena: GpuBufferArena | undefined;
    try {
      DenseLinear.validateWeight(inputWeights.imageEmbedder, spec.dimensions, spec.inputChannels);
      DenseLinear.validateWeight(inputWeights.contextEmbedder, spec.dimensions, spec.contextDimensions);
      const imageInput = initialArena.upload(input.imageTokens, undefined, "bonsai-image-tokens");
      const textInput = initialArena.upload(input.textEmbeddings, undefined, "bonsai-text-embeddings");
      const imageWeight = initialArena.upload(inputWeights.imageEmbedder.values, undefined, "bonsai-image-embedder-weight");
      const textWeight = initialArena.upload(inputWeights.contextEmbedder.values, undefined, "bonsai-context-embedder-weight");
      imageState = initialArena.create(imageRows * spec.dimensions * 4, undefined, "bonsai-image-hidden");
      textState = initialArena.create(textRows * spec.dimensions * 4, undefined, "bonsai-text-hidden");
      const imageShape = initialArena.uniform([imageRows, spec.dimensions, spec.inputChannels, 0]);
      const textShape = initialArena.uniform([textRows, spec.dimensions, spec.contextDimensions, 0]);
      const initialEncoder = this.device.createCommandEncoder({ label: "bonsai-owned-input-projections" });
      this.dense.encode(initialEncoder, imageInput, imageWeight, imageState, imageShape, imageRows, spec.dimensions);
      this.dense.encode(initialEncoder, textInput, textWeight, textState, textShape, textRows, spec.dimensions);
      this.device.queue.submit([initialEncoder.finish()]);

      const imageRope = this.uploadRope(ropeArena, flux2ImageIds(input.width, input.height), imageRows, "image");
      const textRope = this.uploadRope(ropeArena, flux2TextIds(textRows), textRows, "text");
      const combinedIds = new Float32Array((textRows + imageRows) * 4);
      combinedIds.set(flux2TextIds(textRows));
      combinedIds.set(flux2ImageIds(input.width, input.height), textRows * 4);
      const combinedRope = this.uploadRope(ropeArena, combinedIds, textRows + imageRows, "combined");
      doubleConditioning = await this.conditioning.prepareDouble(
        timestep.embedding, firstDouble.imageModulation, firstDouble.textModulation,
      );

      for (let index = 0; index < spec.doubleBlocks; index += 1) {
        input.signal?.throwIfAborted();
        const block = index === 0 ? firstDouble : await this.loadDouble(index, input.signal);
        const execution = await this.doubleExecutor.encode(imageState, textState, imageRows, textRows, block, {
          image: doubleConditioning.image,
          text: doubleConditioning.text,
          imageRope,
          textRope,
        }, input.maxWorkingBytes);
        await this.device.queue.onSubmittedWorkDone();
        currentArena.destroy();
        currentArena = execution.arena;
        imageState = execution.image;
        textState = execution.text;
      }

      const firstSingle = await this.loadSingle(0, input.signal);
      singleConditioning = this.conditioning.prepareSingle(timestep.embedding, firstSingle.modulation, combinedRope);
      const joinedArena = new GpuBufferArena(this.device);
      const joinedRows = textRows + imageRows;
      let joinedState = joinedArena.create(joinedRows * spec.dimensions * 4, undefined, "bonsai-joined-hidden");
      const joinEncoder = this.device.createCommandEncoder({ label: "bonsai-owned-join-streams" });
      joinEncoder.copyBufferToBuffer(textState, 0, joinedState, 0, textRows * spec.dimensions * 4);
      joinEncoder.copyBufferToBuffer(imageState, 0, joinedState, textRows * spec.dimensions * 4, imageRows * spec.dimensions * 4);
      this.device.queue.submit([joinEncoder.finish()]);
      await this.device.queue.onSubmittedWorkDone();
      currentArena.destroy();
      currentArena = joinedArena;

      for (let index = 0; index < spec.singleBlocks; index += 1) {
        input.signal?.throwIfAborted();
        const block = index === 0 ? firstSingle : await this.loadSingle(index, input.signal);
        const execution = await this.singleExecutor.encode(joinedState, joinedRows, block, singleConditioning,
          input.maxWorkingBytes);
        await this.device.queue.onSubmittedWorkDone();
        currentArena.destroy();
        currentArena = execution.arena;
        joinedState = execution.output;
      }

      const outputWeights = await this.weights.loadOutput(input.signal);
      DenseLinear.validateWeight(outputWeights.outputProjection, spec.inputChannels, spec.dimensions);
      finalConditioning = this.conditioning.prepareFinal(timestep.embedding, outputWeights.finalModulation);
      const outputArena = new GpuBufferArena(this.device);
      pendingOutputArena = outputArena;
      const imageHidden = outputArena.create(imageRows * spec.dimensions * 4, undefined, "bonsai-final-image-hidden");
      const normalized = outputArena.create(imageRows * spec.dimensions * 4, undefined, "bonsai-final-normalized");
      const prediction = outputArena.create(imageRows * spec.inputChannels * 4, undefined, "bonsai-noise-prediction");
      const outputWeight = outputArena.upload(outputWeights.outputProjection.values, undefined, "bonsai-output-weight");
      const normShape = outputArena.uniform([imageRows, spec.dimensions, floatBits(spec.layerNormEpsilon), 0]);
      const outputShape = outputArena.uniform([imageRows, spec.inputChannels, spec.dimensions, 0]);
      const finalEncoder = this.device.createCommandEncoder({ label: "bonsai-owned-final-projection" });
      finalEncoder.copyBufferToBuffer(joinedState, textRows * spec.dimensions * 4, imageHidden, 0,
        imageRows * spec.dimensions * 4);
      this.primitives.encode("affine_layer_norm", finalEncoder, imageHidden, finalConditioning.scale,
        finalConditioning.shift, normalized, normShape, [imageRows]);
      this.dense.encode(finalEncoder, normalized, outputWeight, prediction, outputShape, imageRows, spec.inputChannels);
      this.device.queue.submit([finalEncoder.finish()]);
      await this.device.queue.onSubmittedWorkDone();
      currentArena.destroy();
      currentArena = undefined;
      finalConditioning.arena.destroy();
      finalConditioning = undefined;
      pendingOutputArena = undefined;
      return { prediction, imageRows, channels: spec.inputChannels, arena: outputArena };
    } catch (error) {
      currentArena?.destroy();
      pendingOutputArena?.destroy();
      throw error;
    } finally {
      doubleConditioning?.arena.destroy();
      singleConditioning?.arena.destroy();
      finalConditioning?.arena.destroy();
      ropeArena.destroy();
      timestep.arena.destroy();
    }
  }

  clearWeightCache(): void {
    this.doubleBlocks.clear();
    this.singleBlocks.clear();
    this.blockLoader.clearShared();
    this.weights.clear();
  }

  private loadDouble(index: number, signal?: AbortSignal): Promise<LoadedDoubleBlock> {
    let promise = this.doubleBlocks.get(index);
    if (!promise) {
      promise = this.blockLoader.loadDouble(index, signal).catch(error => {
        this.doubleBlocks.delete(index);
        throw error;
      });
      this.doubleBlocks.set(index, promise);
    }
    return promise;
  }

  private loadSingle(index: number, signal?: AbortSignal): Promise<LoadedSingleBlock> {
    let promise = this.singleBlocks.get(index);
    if (!promise) {
      promise = this.blockLoader.loadSingle(index, signal).catch(error => {
        this.singleBlocks.delete(index);
        throw error;
      });
      this.singleBlocks.set(index, promise);
    }
    return promise;
  }

  private uploadRope(arena: GpuBufferArena, ids: Float32Array, rows: number, label: string): GPUBuffer {
    return arena.upload(packRotaryEmbedding(flux2RotaryEmbedding(ids, rows)), undefined, `bonsai-${label}-rope`);
  }
}

function floatBits(value: number): number {
  const memory = new ArrayBuffer(4);
  new Float32Array(memory)[0] = value;
  return new Uint32Array(memory)[0];
}
