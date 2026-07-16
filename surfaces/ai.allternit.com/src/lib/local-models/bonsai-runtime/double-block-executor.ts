import type { LoadedDoubleBlock } from "./block-loader";
import type { ModulationTriple } from "./conditioning";
import { GpuBufferArena } from "./gpu-buffer-arena";
import { OnlineAttention } from "./online-attention";
import { PackedAffineMatmul, type PackedAffineMatrix } from "./packed-affine-matmul";
import { TensorLayout } from "./tensor-layout";
import { TransformerPrimitives, type GpuBufferResource } from "./transformer-primitives";
import { KLEIN_TRANSFORMER_SPEC } from "./transformer-spec";

export interface DoubleBlockConditioning {
  image: [ModulationTriple, ModulationTriple];
  text: [ModulationTriple, ModulationTriple];
  imageRope: GpuBufferResource;
  textRope: GpuBufferResource;
}

export interface DoubleBlockExecution {
  image: GPUBuffer;
  text: GPUBuffer;
  arena: GpuBufferArena;
  estimatedWorkingBytes: number;
}

interface UploadedMatrix {
  packed: GPUBuffer;
  scales: GPUBuffer;
  biases: GPUBuffer;
  dimensions: GPUBuffer;
}

const F32 = 4;

export function estimateDoubleBlockWorkingBytes(imageRows: number, textRows: number): number {
  const { dimensions: width, mlpDimensions: mlp } = KLEIN_TRANSFORMER_SPEC;
  const rows = imageRows + textRows;
  // Attention normalization/projections/head layouts/joint tensors/output plus
  // both feed-forward normalization, pairs, activations, deltas, and outputs.
  return F32 * (rows * width * 14 + rows * (width + 2 * mlp + mlp + width + width));
}

export class DoubleBlockExecutor {
  private readonly matmul: PackedAffineMatmul;
  private readonly attention: OnlineAttention;
  private readonly primitives: TransformerPrimitives;
  private readonly layout: TensorLayout;

  constructor(private readonly device: GPUDevice) {
    this.matmul = new PackedAffineMatmul(device);
    this.attention = new OnlineAttention(device);
    this.primitives = new TransformerPrimitives(device);
    this.layout = new TensorLayout(device);
  }

  async encode(imageState: GPUBuffer, textState: GPUBuffer, imageRows: number, textRows: number,
    block: LoadedDoubleBlock, conditioning: DoubleBlockConditioning,
    maxWorkingBytes = 2_000_000_000): Promise<DoubleBlockExecution> {
    const spec = KLEIN_TRANSFORMER_SPEC;
    const totalRows = imageRows + textRows;
    const estimatedWorkingBytes = estimateDoubleBlockWorkingBytes(imageRows, textRows);
    if (estimatedWorkingBytes > maxWorkingBytes) {
      throw new Error(`Double transformer block needs about ${estimatedWorkingBytes} working bytes; limit is ${maxWorkingBytes}`);
    }
    const largestRows = Math.max(imageRows, textRows);
    const largestBindingBytes = largestRows * spec.mlpDimensions * 2 * F32;
    const tiledFeedForward = largestBindingBytes > this.device.limits.maxStorageBufferBindingSize;
    this.validateBlock(block);
    const arena = new GpuBufferArena(this.device);
    try {
      const buffer = (elements: number, label: string) => arena.create(elements * F32, undefined, label);
      const imageNorm = buffer(imageRows * spec.dimensions, "bonsai-double-image-attention-norm");
      const textNorm = buffer(textRows * spec.dimensions, "bonsai-double-text-attention-norm");
      const projections = Array.from({ length: 6 }, (_, index) =>
        buffer((index < 3 ? imageRows : textRows) * spec.dimensions, `bonsai-double-projection-${index}`));
      const headed = Array.from({ length: 6 }, (_, index) =>
        buffer((index < 3 ? imageRows : textRows) * spec.dimensions, `bonsai-double-headed-${index}`));
      const normalizedQk = Array.from({ length: 4 }, (_, index) =>
        buffer((index < 2 ? imageRows : textRows) * spec.dimensions, `bonsai-double-normalized-qk-${index}`));
      const jointQ = buffer(totalRows * spec.dimensions, "bonsai-double-joint-query");
      const jointK = buffer(totalRows * spec.dimensions, "bonsai-double-joint-key");
      const jointV = buffer(totalRows * spec.dimensions, "bonsai-double-joint-value");
      const jointAttention = buffer(totalRows * spec.dimensions, "bonsai-double-joint-attention");
      const imageAttention = buffer(imageRows * spec.dimensions, "bonsai-double-image-attention");
      const textAttention = buffer(textRows * spec.dimensions, "bonsai-double-text-attention");
      const imageDelta = buffer(imageRows * spec.dimensions, "bonsai-double-image-attention-delta");
      const textDelta = buffer(textRows * spec.dimensions, "bonsai-double-text-attention-delta");
      const imageAfterAttention = buffer(imageRows * spec.dimensions, "bonsai-double-image-after-attention");
      const textAfterAttention = buffer(textRows * spec.dimensions, "bonsai-double-text-after-attention");

      const matrices = [block.imageQuery, block.imageKey, block.imageValue, block.textQuery, block.textKey,
        block.textValue, block.imageAttentionOutput, block.textAttentionOutput, block.imageFeedForwardInput,
        block.imageFeedForwardOutput, block.textFeedForwardInput, block.textFeedForwardOutput];
      const matrixRows = [imageRows, imageRows, imageRows, textRows, textRows, textRows, imageRows, textRows,
        imageRows, imageRows, textRows, textRows];
      const uploaded = matrices.map((matrix, index) => this.upload(arena, matrix, matrixRows[index]));
      const normWeights = [block.imageQueryNorm, block.imageKeyNorm, block.textQueryNorm, block.textKeyNorm]
        .map(weight => arena.upload(weight.values, undefined, weight.name));
      const imageNormShape = arena.uniform([imageRows, spec.dimensions, floatBits(spec.layerNormEpsilon), 0]);
      const textNormShape = arena.uniform([textRows, spec.dimensions, floatBits(spec.layerNormEpsilon), 0]);
      const imageRopeShape = arena.uniform([imageRows, spec.heads, spec.headDimensions, floatBits(spec.rmsNormEpsilon)]);
      const textRopeShape = arena.uniform([textRows, spec.heads, spec.headDimensions, floatBits(spec.rmsNormEpsilon)]);
      const imageLayout = arena.uniform([imageRows, spec.dimensions, spec.heads, 0]);
      const textLayout = arena.uniform([textRows, spec.dimensions, spec.heads, 0]);
      const jointLayout = arena.uniform([textRows, spec.dimensions, spec.heads, imageRows]);
      const textSlice = arena.uniform([totalRows, spec.dimensions, spec.heads, 0]);
      const imageSlice = arena.uniform([totalRows, spec.dimensions, spec.heads, textRows]);
      const attentionShape = arena.uniform([totalRows, totalRows, spec.heads, spec.headDimensions]);
      const imageResidualShape = arena.uniform([imageRows, spec.dimensions, 0, 0]);
      const textResidualShape = arena.uniform([textRows, spec.dimensions, 0, 0]);

      const encoder = this.device.createCommandEncoder({ label: `bonsai-owned-double-block-${block.index}` });
      this.primitives.encode("affine_layer_norm", encoder, imageState, conditioning.image[0].scale,
        conditioning.image[0].shift, imageNorm, imageNormShape, [imageRows]);
      this.primitives.encode("affine_layer_norm", encoder, textState, conditioning.text[0].scale,
        conditioning.text[0].shift, textNorm, textNormShape, [textRows]);
      for (let index = 0; index < 6; index += 1) {
        const input = index < 3 ? imageNorm : textNorm;
        this.matmul.encode(encoder, input, uploaded[index].packed, uploaded[index].scales, uploaded[index].biases,
          projections[index], uploaded[index].dimensions, matrixShape(matrixRows[index], matrices[index]));
        const rows = index < 3 ? imageRows : textRows;
        const dimensions = index < 3 ? imageLayout : textLayout;
        this.layout.encode("rows_to_heads", encoder, projections[index], projections[index], headed[index], dimensions,
          { rows, width: spec.dimensions, heads: spec.heads, mlpWidth: 0 });
      }
      this.primitives.encode("rms_norm_rope", encoder, headed[0], normWeights[0], conditioning.imageRope,
        normalizedQk[0], imageRopeShape, [imageRows, spec.heads]);
      this.primitives.encode("rms_norm_rope", encoder, headed[1], normWeights[1], conditioning.imageRope,
        normalizedQk[1], imageRopeShape, [imageRows, spec.heads]);
      this.primitives.encode("rms_norm_rope", encoder, headed[3], normWeights[2], conditioning.textRope,
        normalizedQk[2], textRopeShape, [textRows, spec.heads]);
      this.primitives.encode("rms_norm_rope", encoder, headed[4], normWeights[3], conditioning.textRope,
        normalizedQk[3], textRopeShape, [textRows, spec.heads]);
      const jointShape = { rows: textRows, width: spec.dimensions, heads: spec.heads, mlpWidth: imageRows };
      this.layout.encode("concat_head_sequences", encoder, normalizedQk[2], normalizedQk[0], jointQ, jointLayout, jointShape);
      this.layout.encode("concat_head_sequences", encoder, normalizedQk[3], normalizedQk[1], jointK, jointLayout, jointShape);
      this.layout.encode("concat_head_sequences", encoder, headed[5], headed[2], jointV, jointLayout, jointShape);
      this.attention.encode(encoder, jointQ, jointK, jointV, jointAttention, attentionShape,
        { batch: 1, heads: spec.heads, queryLength: totalRows, keyLength: totalRows, headDimensions: 128 });
      this.layout.encode("heads_to_rows_slice", encoder, jointAttention, jointAttention, textAttention, textSlice,
        { rows: totalRows, width: spec.dimensions, heads: spec.heads, mlpWidth: 0, outputRows: textRows });
      this.layout.encode("heads_to_rows_slice", encoder, jointAttention, jointAttention, imageAttention, imageSlice,
        { rows: totalRows, width: spec.dimensions, heads: spec.heads, mlpWidth: textRows, outputRows: imageRows });
      this.projectAndGate(encoder, imageState, imageAttention, imageDelta, imageAfterAttention, uploaded[6], matrices[6],
        imageRows, conditioning.image[0].gate, imageResidualShape);
      this.projectAndGate(encoder, textState, textAttention, textDelta, textAfterAttention, uploaded[7], matrices[7],
        textRows, conditioning.text[0].gate, textResidualShape);
      let image: GPUBuffer;
      let text: GPUBuffer;
      if (tiledFeedForward) {
        this.device.queue.submit([encoder.finish()]);
        await this.device.queue.onSubmittedWorkDone();
        image = await this.feedForwardTiled(arena, imageAfterAttention, imageRows, uploaded[8], matrices[8],
          uploaded[9], matrices[9], conditioning.image[1], "image");
        text = await this.feedForwardTiled(arena, textAfterAttention, textRows, uploaded[10], matrices[10],
          uploaded[11], matrices[11], conditioning.text[1], "text");
      } else {
        image = this.feedForward(encoder, arena, imageAfterAttention, imageRows, uploaded[8], matrices[8],
          uploaded[9], matrices[9], conditioning.image[1], imageNormShape, imageResidualShape, "image");
        text = this.feedForward(encoder, arena, textAfterAttention, textRows, uploaded[10], matrices[10],
          uploaded[11], matrices[11], conditioning.text[1], textNormShape, textResidualShape, "text");
        this.device.queue.submit([encoder.finish()]);
      }
      return { image, text, arena, estimatedWorkingBytes };
    } catch (error) {
      arena.destroy();
      throw error;
    }
  }

  private async feedForwardTiled(arena: GpuBufferArena, state: GPUBuffer, rows: number,
    inputWeights: UploadedMatrix, inputMatrix: PackedAffineMatrix, outputWeights: UploadedMatrix,
    outputMatrix: PackedAffineMatrix, modulation: ModulationTriple, stream: string): Promise<GPUBuffer> {
    const spec = KLEIN_TRANSFORMER_SPEC;
    const pairWidth = spec.mlpDimensions * 2;
    const tileRows = Math.max(1, Math.min(rows,
      Math.floor((this.device.limits.maxStorageBufferBindingSize - 256) / (pairWidth * F32))));
    const output = arena.create(rows * spec.dimensions * F32, undefined, `bonsai-double-${stream}-ff-output`);
    for (let start = 0; start < rows; start += tileRows) {
      const count = Math.min(tileRows, rows - start);
      const normalized = arena.create(count * spec.dimensions * F32, undefined, `bonsai-double-${stream}-ff-norm-tile`);
      const pair = arena.create(count * pairWidth * F32, undefined, `bonsai-double-${stream}-ff-pair-tile`);
      const activated = arena.create(count * spec.mlpDimensions * F32, undefined, `bonsai-double-${stream}-ff-activated-tile`);
      const delta = arena.create(count * spec.dimensions * F32, undefined, `bonsai-double-${stream}-ff-delta-tile`);
      const normShape = arena.uniform([count, spec.dimensions, floatBits(spec.layerNormEpsilon), 0]);
      const inputShape = arena.uniform([count, inputMatrix.rows, inputMatrix.columns,
        inputMatrix.groupSize, inputMatrix.bits ?? 2]);
      const outputShape = arena.uniform([count, outputMatrix.rows, outputMatrix.columns,
        outputMatrix.groupSize, outputMatrix.bits ?? 2]);
      const swigluShape = arena.uniform([count, spec.mlpDimensions, 0, 0]);
      const residualShape = arena.uniform([count, spec.dimensions, 0, 0]);
      const stateSlice = resourceSlice(state, start * spec.dimensions * F32, count * spec.dimensions * F32);
      const outputSlice = resourceSlice(output, start * spec.dimensions * F32, count * spec.dimensions * F32);
      const encoder = this.device.createCommandEncoder({ label: `bonsai-double-${stream}-ff-tile-${start}` });
      this.primitives.encode("affine_layer_norm", encoder, stateSlice, modulation.scale, modulation.shift,
        normalized, normShape, [count]);
      this.matmul.encode(encoder, normalized, inputWeights.packed, inputWeights.scales, inputWeights.biases,
        pair, inputShape, matrixShape(count, inputMatrix));
      this.primitives.encode("swiglu", encoder, pair, pair, pair, activated, swigluShape,
        [Math.ceil(count * spec.mlpDimensions / 256)]);
      this.matmul.encode(encoder, activated, outputWeights.packed, outputWeights.scales, outputWeights.biases,
        delta, outputShape, matrixShape(count, outputMatrix));
      this.primitives.encode("gated_residual", encoder, stateSlice, delta, modulation.gate, outputSlice,
        residualShape, [Math.ceil(count * spec.dimensions / 256)]);
      this.device.queue.submit([encoder.finish()]);
      await this.device.queue.onSubmittedWorkDone();
      for (const buffer of [normalized, pair, activated, delta, normShape, inputShape, outputShape,
        swigluShape, residualShape]) arena.release(buffer);
    }
    return output;
  }

  private feedForward(encoder: GPUCommandEncoder, arena: GpuBufferArena, state: GPUBuffer, rows: number,
    inputWeights: UploadedMatrix, inputMatrix: PackedAffineMatrix, outputWeights: UploadedMatrix,
    outputMatrix: PackedAffineMatrix, modulation: ModulationTriple, normShape: GPUBuffer,
    residualShape: GPUBuffer, stream: string): GPUBuffer {
    const spec = KLEIN_TRANSFORMER_SPEC;
    const create = (elements: number, name: string) => arena.create(elements * F32, undefined, `bonsai-double-${stream}-${name}`);
    const normalized = create(rows * spec.dimensions, "ff-norm");
    const pair = create(rows * spec.mlpDimensions * 2, "ff-pair");
    const activated = create(rows * spec.mlpDimensions, "ff-activated");
    const delta = create(rows * spec.dimensions, "ff-delta");
    const output = create(rows * spec.dimensions, "ff-output");
    const swigluShape = arena.uniform([rows, spec.mlpDimensions, 0, 0]);
    this.primitives.encode("affine_layer_norm", encoder, state, modulation.scale, modulation.shift,
      normalized, normShape, [rows]);
    this.matmul.encode(encoder, normalized, inputWeights.packed, inputWeights.scales, inputWeights.biases,
      pair, inputWeights.dimensions, matrixShape(rows, inputMatrix));
    this.primitives.encode("swiglu", encoder, pair, pair, pair, activated, swigluShape,
      [Math.ceil(rows * spec.mlpDimensions / 256)]);
    this.matmul.encode(encoder, activated, outputWeights.packed, outputWeights.scales, outputWeights.biases,
      delta, outputWeights.dimensions, matrixShape(rows, outputMatrix));
    this.primitives.encode("gated_residual", encoder, state, delta, modulation.gate, output, residualShape,
      [Math.ceil(rows * spec.dimensions / 256)]);
    return output;
  }

  private projectAndGate(encoder: GPUCommandEncoder, state: GPUBuffer, attention: GPUBuffer, delta: GPUBuffer,
    output: GPUBuffer, uploaded: UploadedMatrix, matrix: PackedAffineMatrix, rows: number,
    gate: GpuBufferResource, residualShape: GPUBuffer): void {
    this.matmul.encode(encoder, attention, uploaded.packed, uploaded.scales, uploaded.biases, delta,
      uploaded.dimensions, matrixShape(rows, matrix));
    this.primitives.encode("gated_residual", encoder, state, delta, gate, output, residualShape,
      [Math.ceil(rows * KLEIN_TRANSFORMER_SPEC.dimensions / 256)]);
  }

  private upload(arena: GpuBufferArena, matrix: PackedAffineMatrix, rows: number): UploadedMatrix {
    return {
      packed: arena.upload(matrix.packedWeights), scales: arena.upload(matrix.scales), biases: arena.upload(matrix.biases),
      dimensions: arena.uniform([rows, matrix.rows, matrix.columns, matrix.groupSize, matrix.bits ?? 2]),
    };
  }

  private validateBlock(block: LoadedDoubleBlock): void {
    const { dimensions: width, mlpDimensions: mlp, headDimensions } = KLEIN_TRANSFORMER_SPEC;
    for (const matrix of [block.imageQuery, block.imageKey, block.imageValue, block.textQuery, block.textKey, block.textValue,
      block.imageAttentionOutput, block.textAttentionOutput]) {
      if (matrix.rows !== width || matrix.columns !== width) throw new Error(`${matrix.name} must be [${width}, ${width}]`);
    }
    for (const matrix of [block.imageFeedForwardInput, block.textFeedForwardInput]) {
      if (matrix.rows !== mlp * 2 || matrix.columns !== width) throw new Error(`${matrix.name} has an invalid FF input shape`);
    }
    for (const matrix of [block.imageFeedForwardOutput, block.textFeedForwardOutput]) {
      if (matrix.rows !== width || matrix.columns !== mlp) throw new Error(`${matrix.name} has an invalid FF output shape`);
    }
    for (const norm of [block.imageQueryNorm, block.imageKeyNorm, block.textQueryNorm, block.textKeyNorm]) {
      if (norm.values.length !== headDimensions) throw new Error(`${norm.name} must contain ${headDimensions} values`);
    }
  }
}

function matrixShape(batchRows: number, matrix: PackedAffineMatrix) {
  return { batchRows, outputColumns: matrix.rows, inner: matrix.columns, groupSize: matrix.groupSize, bits: matrix.bits ?? 2 };
}

function resourceSlice(buffer: GPUBuffer, offset: number, size: number): GPUBufferBinding {
  return { buffer, offset, size };
}

function floatBits(value: number): number {
  const memory = new ArrayBuffer(4);
  new Float32Array(memory)[0] = value;
  return new Uint32Array(memory)[0];
}
