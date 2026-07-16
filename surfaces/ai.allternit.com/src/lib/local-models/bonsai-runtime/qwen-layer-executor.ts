import { GpuBufferArena } from "./gpu-buffer-arena";
import { BONSAI_TEXT_ENCODER } from "./model-spec";
import { PackedAffineMatmul, type PackedAffineMatrix } from "./packed-affine-matmul";
import { QwenKernels } from "./qwen-kernels";
import type { LoadedQwenLayer } from "./text-encoder-loader";
import { TensorLayout } from "./tensor-layout";
import { TransformerPrimitives } from "./transformer-primitives";

export interface QwenLayerExecution {
  output: GPUBuffer;
  arena: GpuBufferArena;
  estimatedWorkingBytes: number;
}

interface UploadedMatrix { packed: GPUBuffer; scales: GPUBuffer; biases: GPUBuffer; dimensions: GPUBuffer }
const F32 = 4;

export function estimateQwenLayerWorkingBytes(sequence: number): number {
  const s = BONSAI_TEXT_ENCODER;
  return sequence * F32 * (s.hiddenDimensions * 6 + s.attentionHeads * s.headDimensions * 4 +
    s.keyValueHeads * s.headDimensions * 4 + s.intermediateDimensions * 3);
}

export class QwenLayerExecutor {
  private readonly matmul: PackedAffineMatmul;
  private readonly kernels: QwenKernels;
  private readonly layout: TensorLayout;
  private readonly primitives: TransformerPrimitives;

  constructor(private readonly device: GPUDevice) {
    this.matmul = new PackedAffineMatmul(device);
    this.kernels = new QwenKernels(device);
    this.layout = new TensorLayout(device);
    this.primitives = new TransformerPrimitives(device);
  }

  encode(state: GPUBuffer, sequence: number, layer: LoadedQwenLayer, rope: GPUBuffer, validTokens = sequence,
    maxWorkingBytes = 1_500_000_000): QwenLayerExecution {
    const spec = BONSAI_TEXT_ENCODER;
    const estimatedWorkingBytes = estimateQwenLayerWorkingBytes(sequence);
    if (estimatedWorkingBytes > maxWorkingBytes) throw new Error(`Qwen layer needs ${estimatedWorkingBytes} working bytes`);
    this.validate(layer);
    const arena = new GpuBufferArena(this.device);
    try {
      const create = (elements: number, label: string) => arena.create(elements * F32, undefined, label);
      const normalized = create(sequence * spec.hiddenDimensions, "bonsai-qwen-attention-norm");
      const query = create(sequence * spec.attentionHeads * spec.headDimensions, "bonsai-qwen-query");
      const key = create(sequence * spec.keyValueHeads * spec.headDimensions, "bonsai-qwen-key");
      const value = create(sequence * spec.keyValueHeads * spec.headDimensions, "bonsai-qwen-value");
      const normalizedQuery = create(sequence * spec.attentionHeads * spec.headDimensions, "bonsai-qwen-normalized-query");
      const normalizedKey = create(sequence * spec.keyValueHeads * spec.headDimensions, "bonsai-qwen-normalized-key");
      const headedValue = create(sequence * spec.keyValueHeads * spec.headDimensions, "bonsai-qwen-headed-value");
      const attention = create(sequence * spec.attentionHeads * spec.headDimensions, "bonsai-qwen-attention");
      const attentionRows = create(sequence * spec.attentionHeads * spec.headDimensions, "bonsai-qwen-attention-rows");
      const attentionDelta = create(sequence * spec.hiddenDimensions, "bonsai-qwen-attention-delta");
      const afterAttention = create(sequence * spec.hiddenDimensions, "bonsai-qwen-after-attention");
      const mlpNorm = create(sequence * spec.hiddenDimensions, "bonsai-qwen-mlp-norm");
      const gate = create(sequence * spec.intermediateDimensions, "bonsai-qwen-gate");
      const up = create(sequence * spec.intermediateDimensions, "bonsai-qwen-up");
      const activated = create(sequence * spec.intermediateDimensions, "bonsai-qwen-activated");
      const mlpDelta = create(sequence * spec.hiddenDimensions, "bonsai-qwen-mlp-delta");
      const output = create(sequence * spec.hiddenDimensions, "bonsai-qwen-output");
      const matrices = [layer.query, layer.key, layer.value, layer.attentionOutput, layer.gate, layer.up, layer.down];
      const uploaded = matrices.map(matrix => this.upload(arena, matrix, sequence));
      const inputNorm = arena.upload(layer.inputNorm.values);
      const queryNorm = arena.upload(layer.queryNorm.values);
      const keyNorm = arena.upload(layer.keyNorm.values);
      const postNorm = arena.upload(layer.postAttentionNorm.values);
      const normShape = arena.uniform([sequence, spec.hiddenDimensions, 0, floatBits(spec.rmsNormEpsilon)]);
      const queryShape = arena.uniform([sequence, spec.headDimensions, spec.attentionHeads, floatBits(spec.rmsNormEpsilon)]);
      const keyShape = arena.uniform([sequence, spec.headDimensions, spec.keyValueHeads, floatBits(spec.rmsNormEpsilon)]);
      const valueLayout = arena.uniform([sequence, spec.keyValueHeads * spec.headDimensions, spec.keyValueHeads, 0]);
      const attentionShape = arena.uniform([sequence, spec.attentionHeads, spec.keyValueHeads, spec.headDimensions,
        Math.min(sequence, Math.max(1, validTokens))]);
      const outputLayout = arena.uniform([sequence, spec.attentionHeads * spec.headDimensions, spec.attentionHeads, 0]);
      const mlpShape = arena.uniform([sequence, spec.intermediateDimensions, 0, 0]);
      const residualShape = arena.uniform([sequence, spec.hiddenDimensions, 0, 0]);
      const encoder = this.device.createCommandEncoder({ label: `bonsai-owned-qwen-layer-${layer.index}` });
      this.kernels.encodePrimitive("rms_norm", encoder, state, inputNorm, inputNorm, normalized, normShape, [sequence]);
      for (let index = 0; index < 3; index += 1) {
        this.matmul.encode(encoder, normalized, uploaded[index].packed, uploaded[index].scales, uploaded[index].biases,
          [query, key, value][index], uploaded[index].dimensions, matrixShape(sequence, matrices[index]));
      }
      this.kernels.encodePrimitive("rms_norm_rope", encoder, query, queryNorm, rope, normalizedQuery, queryShape,
        [sequence, spec.attentionHeads]);
      this.kernels.encodePrimitive("rms_norm_rope", encoder, key, keyNorm, rope, normalizedKey, keyShape,
        [sequence, spec.keyValueHeads]);
      this.layout.encode("rows_to_heads", encoder, value, value, headedValue, valueLayout,
        { rows: sequence, width: spec.keyValueHeads * spec.headDimensions, heads: spec.keyValueHeads, mlpWidth: 0 });
      this.kernels.encodeAttention(encoder, normalizedQuery, normalizedKey, headedValue, attention, attentionShape,
        sequence, spec.attentionHeads);
      this.layout.encode("heads_to_rows_slice", encoder, attention, attention, attentionRows, outputLayout,
        { rows: sequence, width: spec.attentionHeads * spec.headDimensions, heads: spec.attentionHeads,
          mlpWidth: 0, outputRows: sequence });
      this.matmul.encode(encoder, attentionRows, uploaded[3].packed, uploaded[3].scales, uploaded[3].biases,
        attentionDelta, uploaded[3].dimensions, matrixShape(sequence, layer.attentionOutput));
      this.primitives.encode("add_residual", encoder, state, attentionDelta, attentionDelta, afterAttention,
        residualShape, [Math.ceil(sequence * spec.hiddenDimensions / 256)]);
      this.kernels.encodePrimitive("rms_norm", encoder, afterAttention, postNorm, postNorm, mlpNorm, normShape, [sequence]);
      for (let index = 4; index <= 5; index += 1) {
        this.matmul.encode(encoder, mlpNorm, uploaded[index].packed, uploaded[index].scales, uploaded[index].biases,
          index === 4 ? gate : up, uploaded[index].dimensions, matrixShape(sequence, matrices[index]));
      }
      this.kernels.encodePrimitive("silu_multiply", encoder, gate, up, up, activated, mlpShape,
        [Math.ceil(sequence * spec.intermediateDimensions / 256)]);
      this.matmul.encode(encoder, activated, uploaded[6].packed, uploaded[6].scales, uploaded[6].biases,
        mlpDelta, uploaded[6].dimensions, matrixShape(sequence, layer.down));
      this.primitives.encode("add_residual", encoder, afterAttention, mlpDelta, mlpDelta, output,
        residualShape, [Math.ceil(sequence * spec.hiddenDimensions / 256)]);
      this.device.queue.submit([encoder.finish()]);
      return { output, arena, estimatedWorkingBytes };
    } catch (error) { arena.destroy(); throw error; }
  }

  private upload(arena: GpuBufferArena, matrix: PackedAffineMatrix, rows: number): UploadedMatrix {
    return { packed: arena.upload(matrix.packedWeights), scales: arena.upload(matrix.scales), biases: arena.upload(matrix.biases),
      dimensions: arena.uniform([rows, matrix.rows, matrix.columns, matrix.groupSize, matrix.bits ?? 4]) };
  }

  private validate(layer: LoadedQwenLayer): void {
    const s = BONSAI_TEXT_ENCODER;
    const shapes: Array<[PackedAffineMatrix, number, number]> = [
      [layer.query, s.attentionHeads * s.headDimensions, s.hiddenDimensions],
      [layer.key, s.keyValueHeads * s.headDimensions, s.hiddenDimensions],
      [layer.value, s.keyValueHeads * s.headDimensions, s.hiddenDimensions],
      [layer.attentionOutput, s.hiddenDimensions, s.attentionHeads * s.headDimensions],
      [layer.gate, s.intermediateDimensions, s.hiddenDimensions], [layer.up, s.intermediateDimensions, s.hiddenDimensions],
      [layer.down, s.hiddenDimensions, s.intermediateDimensions],
    ];
    for (const [matrix, rows, columns] of shapes) if (matrix.rows !== rows || matrix.columns !== columns) {
      throw new Error(`${matrix.name} must be [${rows}, ${columns}]`);
    }
  }
}

function matrixShape(batchRows: number, matrix: PackedAffineMatrix) {
  return { batchRows, outputColumns: matrix.rows, inner: matrix.columns, groupSize: matrix.groupSize,
    bits: matrix.bits ?? 4 } as const;
}
function floatBits(value: number): number { const memory = new ArrayBuffer(4); new Float32Array(memory)[0] = value; return new Uint32Array(memory)[0]; }
