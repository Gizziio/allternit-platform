import { BONSAI_MODEL_REPOSITORY, BONSAI_MODEL_REVISION, BONSAI_TEXT_ENCODER } from "./model-spec";
import { bfloat16ToFloat32 } from "./numeric";
import type { LoadedDenseTensor, LoadedPackedAffineMatrix } from "./packed-affine-loader";
import { SafeTensorsRangeReader } from "./safetensors-range";
import { qwenLayerWeightKeys } from "./text-encoder-spec";
import { QWEN_EMBEDDING_KEY } from "./text-encoder-spec";

export interface LoadedQwenLayer {
  index: number;
  inputNorm: LoadedDenseTensor;
  query: LoadedPackedAffineMatrix;
  key: LoadedPackedAffineMatrix;
  value: LoadedPackedAffineMatrix;
  queryNorm: LoadedDenseTensor;
  keyNorm: LoadedDenseTensor;
  attentionOutput: LoadedPackedAffineMatrix;
  postAttentionNorm: LoadedDenseTensor;
  gate: LoadedPackedAffineMatrix;
  up: LoadedPackedAffineMatrix;
  down: LoadedPackedAffineMatrix;
}

export interface LoadedQwenEmbeddingRows {
  matrix: LoadedPackedAffineMatrix;
  tokenRows: Uint32Array;
  vocabularyRows: Uint32Array;
}

export class BonsaiTextEncoderReader {
  readonly tensors: SafeTensorsRangeReader;

  constructor(fetchImpl: typeof fetch = fetch) {
    const url = `https://huggingface.co/${BONSAI_MODEL_REPOSITORY}/resolve/${BONSAI_MODEL_REVISION}/${BONSAI_TEXT_ENCODER.path}`;
    this.tensors = new SafeTensorsRangeReader(url, fetchImpl);
  }

  async loadDense(name: string, signal?: AbortSignal): Promise<LoadedDenseTensor> {
    const tensor = await this.tensors.readTensor(name, signal);
    if (tensor.info.dtype !== "BF16") throw new Error(`${name} is not BF16`);
    return { name, shape: [...tensor.info.shape], values: bfloat16ToFloat32(tensor.data) };
  }

  async loadLinear(name: string, signal?: AbortSignal): Promise<LoadedPackedAffineMatrix> {
    const [weight, scales, biases] = await Promise.all([
      this.tensors.readTensor(`${name}.weight`, signal),
      this.tensors.readTensor(`${name}.scales`, signal),
      this.tensors.readTensor(`${name}.biases`, signal),
    ]);
    if (weight.info.dtype !== "U32" || weight.info.shape.length !== 2 ||
        scales.info.dtype !== "BF16" || biases.info.dtype !== "BF16") {
      throw new Error(`${name} is not an MLX packed-affine 4-bit matrix`);
    }
    const [rows, packedColumns] = weight.info.shape;
    const columns = packedColumns * (32 / BONSAI_TEXT_ENCODER.bits);
    const affineShape = [rows, columns / BONSAI_TEXT_ENCODER.groupSize];
    for (const info of [scales.info, biases.info]) {
      if (info.shape[0] !== affineShape[0] || info.shape[1] !== affineShape[1]) {
        throw new Error(`${name} affine parameter shape mismatch`);
      }
    }
    return {
      name, rows, columns, groupSize: BONSAI_TEXT_ENCODER.groupSize, bits: BONSAI_TEXT_ENCODER.bits,
      packedWeights: new Uint32Array(weight.data), scales: bfloat16ToFloat32(scales.data),
      biases: bfloat16ToFloat32(biases.data),
    };
  }

  async loadLayer(index: number, signal?: AbortSignal): Promise<LoadedQwenLayer> {
    const keys = qwenLayerWeightKeys(index);
    const [inputNorm, query, key, value, queryNorm, keyNorm, attentionOutput, postAttentionNorm, gate, up, down] = await Promise.all([
      this.loadDense(keys.inputNorm, signal), this.loadLinear(keys.query, signal), this.loadLinear(keys.key, signal),
      this.loadLinear(keys.value, signal), this.loadDense(keys.queryNorm, signal), this.loadDense(keys.keyNorm, signal),
      this.loadLinear(keys.attentionOutput, signal), this.loadDense(keys.postAttentionNorm, signal),
      this.loadLinear(keys.gate, signal), this.loadLinear(keys.up, signal), this.loadLinear(keys.down, signal),
    ]);
    return { index, inputNorm, query, key, value, queryNorm, keyNorm, attentionOutput, postAttentionNorm, gate, up, down };
  }

  async loadEmbeddingRows(tokenIds: Uint32Array, signal?: AbortSignal): Promise<LoadedQwenEmbeddingRows> {
    const vocabularyRowList = [...new Set(tokenIds)];
    const vocabularyRows = Uint32Array.from(vocabularyRowList);
    const rowMap = new Map(vocabularyRowList.map((row, index) => [row, index]));
    const [weight, scales, biases] = await Promise.all([
      this.tensors.readRows(`${QWEN_EMBEDDING_KEY}.weight`, vocabularyRowList, signal),
      this.tensors.readRows(`${QWEN_EMBEDDING_KEY}.scales`, vocabularyRowList, signal),
      this.tensors.readRows(`${QWEN_EMBEDDING_KEY}.biases`, vocabularyRowList, signal),
    ]);
    const columns = weight.info.shape[1] * (32 / BONSAI_TEXT_ENCODER.bits);
    if (columns !== BONSAI_TEXT_ENCODER.hiddenDimensions) throw new Error("Qwen embedding width mismatch");
    return {
      matrix: {
        name: QWEN_EMBEDDING_KEY, rows: vocabularyRows.length, columns,
        groupSize: BONSAI_TEXT_ENCODER.groupSize, bits: BONSAI_TEXT_ENCODER.bits,
        packedWeights: new Uint32Array(weight.data), scales: bfloat16ToFloat32(scales.data),
        biases: bfloat16ToFloat32(biases.data),
      },
      tokenRows: Uint32Array.from(tokenIds, token => rowMap.get(token)!),
      vocabularyRows,
    };
  }
}
