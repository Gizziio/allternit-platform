import type { LoadedSingleBlock } from "./block-loader";
import { GpuBufferArena } from "./gpu-buffer-arena";
import { OnlineAttention } from "./online-attention";
import { PackedAffineMatmul, type PackedAffineMatrix } from "./packed-affine-matmul";
import { TensorLayout } from "./tensor-layout";
import { TiledSingleBlockExecutor } from "./tiled-single-block-executor";
import { TransformerPrimitives } from "./transformer-primitives";
import { KLEIN_TRANSFORMER_SPEC } from "./transformer-spec";

export interface SingleBlockConditioning {
  shift: GPUBuffer | GPUBufferBinding;
  scale: GPUBuffer | GPUBufferBinding;
  gate: GPUBuffer | GPUBufferBinding;
  rope: GPUBuffer;
}

export interface SingleBlockExecution {
  output: GPUBuffer;
  arena: GpuBufferArena;
  estimatedWorkingBytes: number;
}

interface UploadedPackedAffine {
  packed: GPUBuffer;
  scales: GPUBuffer;
  biases: GPUBuffer;
  dimensions: GPUBuffer;
}

const FLOAT_BYTES = 4;

export function estimateSingleBlockWorkingBytes(rows: number): number {
  const { dimensions: width, mlpDimensions: mlp } = KLEIN_TRANSFORMER_SPEC;
  // Normalized state, raw/split projection, normalized Q/K, attention, MLP,
  // concatenation, projected delta, and output. Packed weights are excluded.
  return FLOAT_BYTES * rows * (width + 2 * (3 * width + 2 * mlp) + 2 * width + width + mlp + width + mlp + width + width);
}

export class SingleBlockExecutor {
  private readonly matmul: PackedAffineMatmul;
  private readonly attention: OnlineAttention;
  private readonly primitives: TransformerPrimitives;
  private readonly layout: TensorLayout;
  private readonly tiled: TiledSingleBlockExecutor;

  constructor(private readonly device: GPUDevice) {
    this.matmul = new PackedAffineMatmul(device);
    this.attention = new OnlineAttention(device);
    this.primitives = new TransformerPrimitives(device);
    this.layout = new TensorLayout(device);
    this.tiled = new TiledSingleBlockExecutor(device);
  }

  encode(state: GPUBuffer, rows: number, block: LoadedSingleBlock, conditioning: SingleBlockConditioning,
    maxWorkingBytes = 2_000_000_000): SingleBlockExecution | Promise<SingleBlockExecution> {
    const spec = KLEIN_TRANSFORMER_SPEC;
    const estimatedWorkingBytes = estimateSingleBlockWorkingBytes(rows);
    if (estimatedWorkingBytes > maxWorkingBytes) {
      throw new Error(`Single transformer block needs about ${estimatedWorkingBytes} working bytes; limit is ${maxWorkingBytes}`);
    }
    const largestBindingBytes = rows * (spec.dimensions * 3 + spec.mlpDimensions * 2) * FLOAT_BYTES;
    if (largestBindingBytes > this.device.limits.maxStorageBufferBindingSize) {
      return this.tiled.encode(state, rows, block, conditioning, maxWorkingBytes);
    }
    this.validateBlock(block);
    const arena = new GpuBufferArena(this.device);
    try {
      const floatBuffer = (elements: number, label: string) => arena.create(elements * FLOAT_BYTES, undefined, label);
      const normalized = floatBuffer(rows * spec.dimensions, "bonsai-single-normalized");
      const projectionElements = rows * (spec.dimensions * 3 + spec.mlpDimensions * 2);
      const projected = floatBuffer(projectionElements, "bonsai-single-projected");
      const split = floatBuffer(projectionElements, "bonsai-single-split");
      const componentElements = rows * spec.dimensions;
      const query = floatBuffer(componentElements, "bonsai-single-query");
      const key = floatBuffer(componentElements, "bonsai-single-key");
      const value = floatBuffer(componentElements, "bonsai-single-value");
      const mlpPair = floatBuffer(rows * spec.mlpDimensions * 2, "bonsai-single-mlp-pair");
      const normalizedQuery = floatBuffer(componentElements, "bonsai-single-normalized-query");
      const normalizedKey = floatBuffer(componentElements, "bonsai-single-normalized-key");
      const attentionOutput = floatBuffer(componentElements, "bonsai-single-attention");
      const mlpOutput = floatBuffer(rows * spec.mlpDimensions, "bonsai-single-mlp");
      const combined = floatBuffer(rows * (spec.dimensions + spec.mlpDimensions), "bonsai-single-combined");
      const delta = floatBuffer(componentElements, "bonsai-single-delta");
      const output = floatBuffer(componentElements, "bonsai-single-output");
      const qkvWeights = this.uploadMatrix(arena, block.qkvMlpProjection, rows);
      const outputWeights = this.uploadMatrix(arena, block.outputProjection, rows);
      const queryNorm = arena.upload(block.queryNorm.values, undefined, "bonsai-single-query-norm");
      const keyNorm = arena.upload(block.keyNorm.values, undefined, "bonsai-single-key-norm");
      const layoutDimensions = arena.uniform([rows, spec.dimensions, spec.heads, spec.mlpDimensions], "bonsai-single-layout-shape");
      const normDimensions = arena.uniform([rows, spec.dimensions, floatBits(spec.layerNormEpsilon), 0], "bonsai-single-norm-shape");
      const ropeDimensions = arena.uniform([rows, spec.heads, spec.headDimensions, floatBits(spec.rmsNormEpsilon)], "bonsai-single-rope-shape");
      const swigluDimensions = arena.uniform([rows, spec.mlpDimensions, 0, 0], "bonsai-single-swiglu-shape");
      const residualDimensions = arena.uniform([rows, spec.dimensions, 0, 0], "bonsai-single-residual-shape");
      const attentionDimensions = arena.uniform([rows, rows, spec.heads, spec.headDimensions], "bonsai-single-attention-shape");

      const encoder = this.device.createCommandEncoder({ label: `bonsai-owned-single-block-${block.index}` });
      this.primitives.encode("affine_layer_norm", encoder, state, conditioning.scale, conditioning.shift,
        normalized, normDimensions, [rows]);
      this.matmul.encode(encoder, normalized, qkvWeights.packed, qkvWeights.scales, qkvWeights.biases,
        projected, qkvWeights.dimensions, matrixShape(rows, block.qkvMlpProjection));
      this.layout.encode("split_qkv_mlp", encoder, projected, projected, split, layoutDimensions,
        { rows, width: spec.dimensions, heads: spec.heads, mlpWidth: spec.mlpDimensions });
      encoder.copyBufferToBuffer(split, 0, query, 0, componentElements * FLOAT_BYTES);
      encoder.copyBufferToBuffer(split, componentElements * FLOAT_BYTES, key, 0, componentElements * FLOAT_BYTES);
      encoder.copyBufferToBuffer(split, componentElements * 2 * FLOAT_BYTES, value, 0, componentElements * FLOAT_BYTES);
      encoder.copyBufferToBuffer(split, componentElements * 3 * FLOAT_BYTES, mlpPair, 0, rows * spec.mlpDimensions * 2 * FLOAT_BYTES);
      this.primitives.encode("rms_norm_rope", encoder, query, queryNorm, conditioning.rope,
        normalizedQuery, ropeDimensions, [rows, spec.heads]);
      this.primitives.encode("rms_norm_rope", encoder, key, keyNorm, conditioning.rope,
        normalizedKey, ropeDimensions, [rows, spec.heads]);
      this.attention.encode(encoder, normalizedQuery, normalizedKey, value, attentionOutput, attentionDimensions,
        { batch: 1, heads: spec.heads, queryLength: rows, keyLength: rows, headDimensions: 128 });
      this.primitives.encode("swiglu", encoder, mlpPair, mlpPair, mlpPair, mlpOutput,
        swigluDimensions, [Math.ceil(rows * spec.mlpDimensions / 256)]);
      this.layout.encode("concat_attention_mlp", encoder, attentionOutput, mlpOutput, combined, layoutDimensions,
        { rows, width: spec.dimensions, heads: spec.heads, mlpWidth: spec.mlpDimensions });
      this.matmul.encode(encoder, combined, outputWeights.packed, outputWeights.scales, outputWeights.biases,
        delta, outputWeights.dimensions, matrixShape(rows, block.outputProjection));
      this.primitives.encode("gated_residual", encoder, state, delta, conditioning.gate, output,
        residualDimensions, [Math.ceil(componentElements / 256)]);
      this.device.queue.submit([encoder.finish()]);
      return { output, arena, estimatedWorkingBytes };
    } catch (error) {
      arena.destroy();
      throw error;
    }
  }

  private uploadMatrix(arena: GpuBufferArena, matrix: PackedAffineMatrix, rows: number): UploadedPackedAffine {
    return {
      packed: arena.upload(matrix.packedWeights, undefined, `${matrix.rows}x${matrix.columns}-packed`),
      scales: arena.upload(matrix.scales, undefined, `${matrix.rows}x${matrix.columns}-scales`),
      biases: arena.upload(matrix.biases, undefined, `${matrix.rows}x${matrix.columns}-biases`),
      dimensions: arena.uniform([rows, matrix.rows, matrix.columns, matrix.groupSize, matrix.bits ?? 2], "bonsai-matmul-shape"),
    };
  }

  private validateBlock(block: LoadedSingleBlock): void {
    const spec = KLEIN_TRANSFORMER_SPEC;
    const projected = spec.dimensions * 3 + spec.mlpDimensions * 2;
    if (block.qkvMlpProjection.columns !== spec.dimensions || block.qkvMlpProjection.rows !== projected) {
      throw new Error(`Unexpected single-block input projection shape for block ${block.index}`);
    }
    if (block.outputProjection.columns !== spec.dimensions + spec.mlpDimensions || block.outputProjection.rows !== spec.dimensions) {
      throw new Error(`Unexpected single-block output projection shape for block ${block.index}`);
    }
    if (block.queryNorm.values.length !== spec.headDimensions || block.keyNorm.values.length !== spec.headDimensions) {
      throw new Error(`Unexpected single-block Q/K norm shape for block ${block.index}`);
    }
  }
}

function matrixShape(batchRows: number, matrix: PackedAffineMatrix) {
  return { batchRows, outputColumns: matrix.rows, inner: matrix.columns, groupSize: matrix.groupSize, bits: matrix.bits ?? 2 };
}

function floatBits(value: number): number {
  const buffer = new ArrayBuffer(4);
  new Float32Array(buffer)[0] = value;
  return new Uint32Array(buffer)[0];
}
