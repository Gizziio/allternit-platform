import { BONSAI_QUANTIZATION, BONSAI_TRANSFORMER, huggingFaceResolveUrl } from "./model-spec";
import { bfloat16ToFloat32 } from "./numeric";
import type { PackedAffineMatrix } from "./packed-affine-matmul";
import { SafeTensorsRangeReader } from "./safetensors-range";

export interface LoadedPackedAffineMatrix extends PackedAffineMatrix {
  name: string;
}

export interface LoadedDenseTensor {
  name: string;
  shape: number[];
  values: Float32Array;
}

export class BonsaiPackedTransformerReader {
  readonly tensors: SafeTensorsRangeReader;

  constructor(fetchImpl: typeof fetch = fetch) {
    this.tensors = new SafeTensorsRangeReader(huggingFaceResolveUrl(BONSAI_TRANSFORMER.path), fetchImpl);
  }

  async loadDense(name: string, signal?: AbortSignal): Promise<LoadedDenseTensor> {
    const tensor = await this.tensors.readTensor(name, signal);
    if (tensor.info.dtype !== "BF16") throw new Error(`${name} is not a dense BF16 tensor`);
    const elements = tensor.info.shape.reduce((product, dimension) => product * dimension, 1);
    if (tensor.data.byteLength !== elements * 2) throw new Error(`${name} byte length does not match its BF16 shape`);
    return { name, shape: [...tensor.info.shape], values: bfloat16ToFloat32(tensor.data) };
  }

  async loadLinear(name: string, signal?: AbortSignal): Promise<LoadedPackedAffineMatrix> {
    const [weight, scales, biases] = await Promise.all([
      this.tensors.readTensor(`${name}.weight`, signal),
      this.tensors.readTensor(`${name}.scales`, signal),
      this.tensors.readTensor(`${name}.biases`, signal),
    ]);
    if (weight.info.dtype !== "U32" || weight.info.shape.length !== 2) {
      throw new Error(`${name}.weight is not a two-dimensional packed U32 matrix`);
    }
    if (scales.info.dtype !== "BF16" || biases.info.dtype !== "BF16") {
      throw new Error(`${name} affine parameters must be BF16`);
    }
    const [rows, packedColumns] = weight.info.shape;
    const columns = packedColumns * (32 / BONSAI_QUANTIZATION.bits);
    const expectedAffineShape = [rows, columns / BONSAI_QUANTIZATION.groupSize];
    if (scales.info.shape[0] !== expectedAffineShape[0] || scales.info.shape[1] !== expectedAffineShape[1] ||
        biases.info.shape[0] !== expectedAffineShape[0] || biases.info.shape[1] !== expectedAffineShape[1]) {
      throw new Error(`${name} affine parameter shape does not match its packed weight`);
    }
    const scaleValues = bfloat16ToFloat32(scales.data);
    const biasValues = bfloat16ToFloat32(biases.data);
    for (let index = 0; index < scaleValues.length; index += 1) {
      if (biasValues[index] !== -scaleValues[index]) {
        throw new Error(`${name} is not a symmetric ternary affine pack at group ${index}`);
      }
    }
    return {
      name,
      rows,
      columns,
      groupSize: BONSAI_QUANTIZATION.groupSize,
      bits: BONSAI_QUANTIZATION.bits,
      packedWeights: new Uint32Array(weight.data),
      scales: scaleValues,
      biases: biasValues,
    };
  }
}
