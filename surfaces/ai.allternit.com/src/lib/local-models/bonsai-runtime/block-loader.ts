import { BonsaiPackedTransformerReader, type LoadedDenseTensor, type LoadedPackedAffineMatrix } from "./packed-affine-loader";
import { doubleBlockWeightKeys, singleBlockWeightKeys } from "./transformer-spec";

export interface LoadedSingleBlock {
  index: number;
  modulation: LoadedDenseTensor;
  qkvMlpProjection: LoadedPackedAffineMatrix;
  outputProjection: LoadedPackedAffineMatrix;
  queryNorm: LoadedDenseTensor;
  keyNorm: LoadedDenseTensor;
}

export interface LoadedDoubleBlock {
  index: number;
  imageModulation: LoadedDenseTensor;
  textModulation: LoadedDenseTensor;
  imageQuery: LoadedPackedAffineMatrix;
  imageKey: LoadedPackedAffineMatrix;
  imageValue: LoadedPackedAffineMatrix;
  textQuery: LoadedPackedAffineMatrix;
  textKey: LoadedPackedAffineMatrix;
  textValue: LoadedPackedAffineMatrix;
  imageAttentionOutput: LoadedPackedAffineMatrix;
  textAttentionOutput: LoadedPackedAffineMatrix;
  imageFeedForwardInput: LoadedPackedAffineMatrix;
  imageFeedForwardOutput: LoadedPackedAffineMatrix;
  textFeedForwardInput: LoadedPackedAffineMatrix;
  textFeedForwardOutput: LoadedPackedAffineMatrix;
  imageQueryNorm: LoadedDenseTensor;
  imageKeyNorm: LoadedDenseTensor;
  textQueryNorm: LoadedDenseTensor;
  textKeyNorm: LoadedDenseTensor;
}

export class BonsaiTransformerBlockLoader {
  private sharedSingleModulation?: Promise<LoadedDenseTensor>;
  private sharedImageModulation?: Promise<LoadedDenseTensor>;
  private sharedTextModulation?: Promise<LoadedDenseTensor>;

  constructor(readonly reader = new BonsaiPackedTransformerReader()) {}

  loadSingle(index: number, signal?: AbortSignal): Promise<LoadedSingleBlock> {
    const keys = singleBlockWeightKeys(index);
    if (!this.sharedSingleModulation) {
      this.sharedSingleModulation = this.reader.loadDense(keys.modulation, signal).catch(error => {
        this.sharedSingleModulation = undefined;
        throw error;
      });
    }
    return Promise.all([
      this.sharedSingleModulation,
      this.reader.loadLinear(keys.qkvMlpProjection, signal),
      this.reader.loadLinear(keys.outputProjection, signal),
      this.reader.loadDense(keys.queryNorm, signal),
      this.reader.loadDense(keys.keyNorm, signal),
    ]).then(([modulation, qkvMlpProjection, outputProjection, queryNorm, keyNorm]) => ({
      index, modulation, qkvMlpProjection, outputProjection, queryNorm, keyNorm,
    }));
  }

  loadDouble(index: number, signal?: AbortSignal): Promise<LoadedDoubleBlock> {
    const keys = doubleBlockWeightKeys(index);
    if (!this.sharedImageModulation) {
      this.sharedImageModulation = this.reader.loadDense(keys.imageModulation, signal).catch(error => {
        this.sharedImageModulation = undefined;
        throw error;
      });
    }
    if (!this.sharedTextModulation) {
      this.sharedTextModulation = this.reader.loadDense(keys.textModulation, signal).catch(error => {
        this.sharedTextModulation = undefined;
        throw error;
      });
    }
    return Promise.all([
      this.sharedImageModulation,
      this.sharedTextModulation,
      this.reader.loadLinear(keys.imageQuery, signal),
      this.reader.loadLinear(keys.imageKey, signal),
      this.reader.loadLinear(keys.imageValue, signal),
      this.reader.loadLinear(keys.textQuery, signal),
      this.reader.loadLinear(keys.textKey, signal),
      this.reader.loadLinear(keys.textValue, signal),
      this.reader.loadLinear(keys.imageAttentionOutput, signal),
      this.reader.loadLinear(keys.textAttentionOutput, signal),
      this.reader.loadLinear(keys.imageFeedForwardInput, signal),
      this.reader.loadLinear(keys.imageFeedForwardOutput, signal),
      this.reader.loadLinear(keys.textFeedForwardInput, signal),
      this.reader.loadLinear(keys.textFeedForwardOutput, signal),
      this.reader.loadDense(keys.imageQueryNorm, signal),
      this.reader.loadDense(keys.imageKeyNorm, signal),
      this.reader.loadDense(keys.textQueryNorm, signal),
      this.reader.loadDense(keys.textKeyNorm, signal),
    ]).then(values => ({
      index,
      imageModulation: values[0], textModulation: values[1],
      imageQuery: values[2], imageKey: values[3], imageValue: values[4],
      textQuery: values[5], textKey: values[6], textValue: values[7],
      imageAttentionOutput: values[8], textAttentionOutput: values[9],
      imageFeedForwardInput: values[10], imageFeedForwardOutput: values[11],
      textFeedForwardInput: values[12], textFeedForwardOutput: values[13],
      imageQueryNorm: values[14], imageKeyNorm: values[15],
      textQueryNorm: values[16], textKeyNorm: values[17],
    }));
  }

  clearShared(): void {
    this.sharedSingleModulation = undefined;
    this.sharedImageModulation = undefined;
    this.sharedTextModulation = undefined;
  }
}
