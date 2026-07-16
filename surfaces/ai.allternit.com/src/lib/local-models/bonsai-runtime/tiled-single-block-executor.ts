import type { LoadedSingleBlock } from "./block-loader";
import { GpuBufferArena } from "./gpu-buffer-arena";
import { OnlineAttention } from "./online-attention";
import { PackedAffineMatmul, type PackedAffineMatrix } from "./packed-affine-matmul";
import type { SingleBlockConditioning, SingleBlockExecution } from "./single-block-executor";
import { TensorLayout } from "./tensor-layout";
import { TransformerPrimitives } from "./transformer-primitives";
import { KLEIN_TRANSFORMER_SPEC } from "./transformer-spec";

const F32 = 4;

interface UploadedMatrix {
  packed: GPUBuffer;
  scales: GPUBuffer;
  biases: GPUBuffer;
}

/** Exact row-tiled single-stream block for adapters with 128 MiB bindings. */
export class TiledSingleBlockExecutor {
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

  async encode(state: GPUBuffer, rows: number, block: LoadedSingleBlock,
    conditioning: SingleBlockConditioning, maxWorkingBytes = 2_000_000_000): Promise<SingleBlockExecution> {
    const spec = KLEIN_TRANSFORMER_SPEC;
    const projectedWidth = spec.dimensions * 3 + spec.mlpDimensions * 2;
    const tileRows = singleBlockTileRows(this.device.limits.maxStorageBufferBindingSize, rows);
    const estimatedWorkingBytes = estimateTiledSingleBlockWorkingBytes(rows, tileRows);
    if (estimatedWorkingBytes > maxWorkingBytes) {
      throw new Error(`Tiled single transformer block needs about ${estimatedWorkingBytes} working bytes; limit is ${maxWorkingBytes}`);
    }
    validateBlock(block);
    const arena = new GpuBufferArena(this.device);
    try {
      const create = (elements: number, label: string) => arena.create(elements * F32, undefined, label);
      const normalized = create(rows * spec.dimensions, "bonsai-tiled-single-normalized");
      const query = create(rows * spec.dimensions, "bonsai-tiled-single-query");
      const key = create(rows * spec.dimensions, "bonsai-tiled-single-key");
      const value = create(rows * spec.dimensions, "bonsai-tiled-single-value");
      const normalizedQuery = create(rows * spec.dimensions, "bonsai-tiled-single-normalized-query");
      const normalizedKey = create(rows * spec.dimensions, "bonsai-tiled-single-normalized-key");
      const attentionOutput = create(rows * spec.dimensions, "bonsai-tiled-single-attention");
      const delta = create(rows * spec.dimensions, "bonsai-tiled-single-delta");
      const output = create(rows * spec.dimensions, "bonsai-tiled-single-output");
      const qkvWeights = uploadMatrix(arena, block.qkvMlpProjection);
      const outputWeights = uploadMatrix(arena, block.outputProjection);
      const queryNorm = arena.upload(block.queryNorm.values, undefined, "bonsai-tiled-single-query-norm");
      const keyNorm = arena.upload(block.keyNorm.values, undefined, "bonsai-tiled-single-key-norm");
      const normDimensions = arena.uniform([rows, spec.dimensions, floatBits(spec.layerNormEpsilon), 0]);
      let encoder = this.device.createCommandEncoder({ label: `bonsai-tiled-single-norm-${block.index}` });
      this.primitives.encode("affine_layer_norm", encoder, state, conditioning.scale, conditioning.shift,
        normalized, normDimensions, [rows]);
      this.device.queue.submit([encoder.finish()]);

      // First pass retains only Q/K/V; the much wider fused MLP projection is
      // discarded tile-by-tile rather than becoming a device-sized buffer.
      for (let start = 0; start < rows; start += tileRows) {
        const count = Math.min(tileRows, rows - start);
        const projected = create(count * projectedWidth, "bonsai-tiled-single-projected");
        const split = create(count * projectedWidth, "bonsai-tiled-single-split");
        const matmulDimensions = arena.uniform([count, block.qkvMlpProjection.rows,
          block.qkvMlpProjection.columns, block.qkvMlpProjection.groupSize, block.qkvMlpProjection.bits ?? 2]);
        const layoutDimensions = arena.uniform([count, spec.dimensions, spec.heads, spec.mlpDimensions]);
        encoder = this.device.createCommandEncoder({ label: `bonsai-tiled-single-qkv-${block.index}-${start}` });
        this.matmul.encode(encoder, slice(normalized, start * spec.dimensions * F32, count * spec.dimensions * F32),
          qkvWeights.packed, qkvWeights.scales, qkvWeights.biases, projected, matmulDimensions,
          matrixShape(count, block.qkvMlpProjection));
        this.layout.encode("split_qkv_mlp", encoder, projected, projected, split, layoutDimensions,
          { rows: count, width: spec.dimensions, heads: spec.heads, mlpWidth: spec.mlpDimensions });
        copyHeadTiles(encoder, split, [query, key, value], start, count, rows, spec.heads, spec.headDimensions);
        this.device.queue.submit([encoder.finish()]);
        await this.device.queue.onSubmittedWorkDone();
        for (const buffer of [projected, split, matmulDimensions, layoutDimensions]) arena.release(buffer);
      }

      const ropeDimensions = arena.uniform([rows, spec.heads, spec.headDimensions, floatBits(spec.rmsNormEpsilon)]);
      const attentionDimensions = arena.uniform([rows, rows, spec.heads, spec.headDimensions]);
      encoder = this.device.createCommandEncoder({ label: `bonsai-tiled-single-attention-${block.index}` });
      this.primitives.encode("rms_norm_rope", encoder, query, queryNorm, conditioning.rope,
        normalizedQuery, ropeDimensions, [rows, spec.heads]);
      this.primitives.encode("rms_norm_rope", encoder, key, keyNorm, conditioning.rope,
        normalizedKey, ropeDimensions, [rows, spec.heads]);
      this.attention.encode(encoder, normalizedQuery, normalizedKey, value, attentionOutput, attentionDimensions,
        { batch: 1, heads: spec.heads, queryLength: rows, keyLength: rows, headDimensions: 128 });
      this.device.queue.submit([encoder.finish()]);
      await this.device.queue.onSubmittedWorkDone();
      for (const buffer of [query, key, value, normalizedQuery, normalizedKey]) arena.release(buffer);

      // Recompute each fused tile to obtain its MLP branch, combine it with the
      // corresponding attention rows, and immediately project into global delta.
      for (let start = 0; start < rows; start += tileRows) {
        const count = Math.min(tileRows, rows - start);
        const projected = create(count * projectedWidth, "bonsai-tiled-single-projected-mlp");
        const split = create(count * projectedWidth, "bonsai-tiled-single-split-mlp");
        const attentionTile = create(count * spec.dimensions, "bonsai-tiled-single-attention-tile");
        const mlp = create(count * spec.mlpDimensions, "bonsai-tiled-single-mlp");
        const combined = create(count * (spec.dimensions + spec.mlpDimensions), "bonsai-tiled-single-combined");
        const deltaTile = create(count * spec.dimensions, "bonsai-tiled-single-delta-tile");
        const inputShape = arena.uniform([count, block.qkvMlpProjection.rows, block.qkvMlpProjection.columns,
          block.qkvMlpProjection.groupSize, block.qkvMlpProjection.bits ?? 2]);
        const outputShape = arena.uniform([count, block.outputProjection.rows, block.outputProjection.columns,
          block.outputProjection.groupSize, block.outputProjection.bits ?? 2]);
        const layoutShape = arena.uniform([count, spec.dimensions, spec.heads, spec.mlpDimensions]);
        const swigluShape = arena.uniform([count, spec.mlpDimensions, 0, 0]);
        encoder = this.device.createCommandEncoder({ label: `bonsai-tiled-single-mlp-${block.index}-${start}` });
        this.matmul.encode(encoder, slice(normalized, start * spec.dimensions * F32, count * spec.dimensions * F32),
          qkvWeights.packed, qkvWeights.scales, qkvWeights.biases, projected, inputShape,
          matrixShape(count, block.qkvMlpProjection));
        this.layout.encode("split_qkv_mlp", encoder, projected, projected, split, layoutShape,
          { rows: count, width: spec.dimensions, heads: spec.heads, mlpWidth: spec.mlpDimensions });
        copyAttentionTile(encoder, attentionOutput, attentionTile, start, count, rows, spec.heads, spec.headDimensions);
        const mlpPairOffset = count * spec.dimensions * 3 * F32;
        this.primitives.encode("swiglu", encoder,
          slice(split, mlpPairOffset, count * spec.mlpDimensions * 2 * F32), split, split, mlp,
          swigluShape, [Math.ceil(count * spec.mlpDimensions / 256)]);
        this.layout.encode("concat_attention_mlp", encoder, attentionTile, mlp, combined, layoutShape,
          { rows: count, width: spec.dimensions, heads: spec.heads, mlpWidth: spec.mlpDimensions });
        this.matmul.encode(encoder, combined, outputWeights.packed, outputWeights.scales, outputWeights.biases,
          deltaTile, outputShape, matrixShape(count, block.outputProjection));
        encoder.copyBufferToBuffer(deltaTile, 0, delta, start * spec.dimensions * F32, count * spec.dimensions * F32);
        this.device.queue.submit([encoder.finish()]);
        await this.device.queue.onSubmittedWorkDone();
        for (const buffer of [projected, split, attentionTile, mlp, combined, deltaTile,
          inputShape, outputShape, layoutShape, swigluShape]) arena.release(buffer);
      }
      arena.release(attentionOutput);
      arena.release(normalized);
      const residualDimensions = arena.uniform([rows, spec.dimensions, 0, 0]);
      encoder = this.device.createCommandEncoder({ label: `bonsai-tiled-single-residual-${block.index}` });
      this.primitives.encode("gated_residual", encoder, state, delta, conditioning.gate, output,
        residualDimensions, [Math.ceil(rows * spec.dimensions / 256)]);
      this.device.queue.submit([encoder.finish()]);
      return { output, arena, estimatedWorkingBytes };
    } catch (error) {
      arena.destroy();
      throw error;
    }
  }
}

export function estimateTiledSingleBlockWorkingBytes(rows: number, tileRows: number): number {
  const { dimensions: width, mlpDimensions: mlp } = KLEIN_TRANSFORMER_SPEC;
  const projected = 3 * width + 2 * mlp;
  const persistent = rows * width * 9;
  const tile = tileRows * (projected * 2 + width + mlp + width + mlp + width);
  return (persistent + tile) * F32;
}

export function singleBlockTileRows(maxStorageBindingBytes: number, rows: number): number {
  const projectedWidth = KLEIN_TRANSFORMER_SPEC.dimensions * 3 + KLEIN_TRANSFORMER_SPEC.mlpDimensions * 2;
  return Math.max(1, Math.min(rows, Math.floor((maxStorageBindingBytes - 256) / (projectedWidth * F32))));
}

function uploadMatrix(arena: GpuBufferArena, matrix: PackedAffineMatrix): UploadedMatrix {
  return { packed: arena.upload(matrix.packedWeights), scales: arena.upload(matrix.scales), biases: arena.upload(matrix.biases) };
}

function slice(buffer: GPUBuffer, offset: number, size: number): GPUBufferBinding {
  return { buffer, offset, size };
}

function copyHeadTiles(encoder: GPUCommandEncoder, source: GPUBuffer, destinations: GPUBuffer[], start: number,
  count: number, totalRows: number, heads: number, headWidth: number): void {
  const componentElements = count * heads * headWidth;
  for (let component = 0; component < destinations.length; component += 1) {
    for (let head = 0; head < heads; head += 1) {
      encoder.copyBufferToBuffer(source, (component * componentElements + head * count * headWidth) * F32,
        destinations[component], (head * totalRows * headWidth + start * headWidth) * F32, count * headWidth * F32);
    }
  }
}

function copyAttentionTile(encoder: GPUCommandEncoder, source: GPUBuffer, destination: GPUBuffer,
  start: number, count: number, totalRows: number, heads: number, headWidth: number): void {
  for (let head = 0; head < heads; head += 1) {
    encoder.copyBufferToBuffer(source, (head * totalRows * headWidth + start * headWidth) * F32,
      destination, head * count * headWidth * F32, count * headWidth * F32);
  }
}

function matrixShape(batchRows: number, matrix: PackedAffineMatrix) {
  return { batchRows, outputColumns: matrix.rows, inner: matrix.columns, groupSize: matrix.groupSize, bits: matrix.bits ?? 2 };
}

function validateBlock(block: LoadedSingleBlock): void {
  const spec = KLEIN_TRANSFORMER_SPEC;
  const projected = spec.dimensions * 3 + spec.mlpDimensions * 2;
  if (block.qkvMlpProjection.columns !== spec.dimensions || block.qkvMlpProjection.rows !== projected) {
    throw new Error(`Unexpected single-block input projection shape for block ${block.index}`);
  }
  if (block.outputProjection.columns !== spec.dimensions + spec.mlpDimensions || block.outputProjection.rows !== spec.dimensions) {
    throw new Error(`Unexpected single-block output projection shape for block ${block.index}`);
  }
}

function floatBits(value: number): number {
  const buffer = new ArrayBuffer(4);
  new Float32Array(buffer)[0] = value;
  return new Uint32Array(buffer)[0];
}
