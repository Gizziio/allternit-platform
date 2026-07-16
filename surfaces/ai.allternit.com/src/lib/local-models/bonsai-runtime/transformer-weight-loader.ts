import type { LoadedDenseTensor } from "./packed-affine-loader";
import { BonsaiPackedTransformerReader } from "./packed-affine-loader";
import { KLEIN_DENSE_WEIGHT_KEYS } from "./transformer-spec";

export interface TransformerInputWeights {
  imageEmbedder: LoadedDenseTensor;
  contextEmbedder: LoadedDenseTensor;
}

export interface TransformerTimestepWeights {
  linear1: LoadedDenseTensor;
  linear2: LoadedDenseTensor;
}

export interface TransformerOutputWeights {
  finalModulation: LoadedDenseTensor;
  outputProjection: LoadedDenseTensor;
}

export class BonsaiTransformerWeightLoader {
  private input?: Promise<TransformerInputWeights>;
  private timestep?: Promise<TransformerTimestepWeights>;
  private output?: Promise<TransformerOutputWeights>;

  constructor(readonly reader = new BonsaiPackedTransformerReader()) {}

  loadInput(signal?: AbortSignal): Promise<TransformerInputWeights> {
    if (!this.input) {
      this.input = Promise.all([
        this.reader.loadDense(KLEIN_DENSE_WEIGHT_KEYS.imageEmbedder, signal),
        this.reader.loadDense(KLEIN_DENSE_WEIGHT_KEYS.contextEmbedder, signal),
      ]).then(([imageEmbedder, contextEmbedder]) => ({ imageEmbedder, contextEmbedder }))
        .catch(error => { this.input = undefined; throw error; });
    }
    return this.input;
  }

  loadTimestep(signal?: AbortSignal): Promise<TransformerTimestepWeights> {
    if (!this.timestep) {
      this.timestep = Promise.all([
        this.reader.loadDense(KLEIN_DENSE_WEIGHT_KEYS.timeEmbedderLinear1, signal),
        this.reader.loadDense(KLEIN_DENSE_WEIGHT_KEYS.timeEmbedderLinear2, signal),
      ]).then(([linear1, linear2]) => ({ linear1, linear2 }))
        .catch(error => { this.timestep = undefined; throw error; });
    }
    return this.timestep;
  }

  loadOutput(signal?: AbortSignal): Promise<TransformerOutputWeights> {
    if (!this.output) {
      this.output = Promise.all([
        this.reader.loadDense(KLEIN_DENSE_WEIGHT_KEYS.finalModulation, signal),
        this.reader.loadDense(KLEIN_DENSE_WEIGHT_KEYS.outputProjection, signal),
      ]).then(([finalModulation, outputProjection]) => ({ finalModulation, outputProjection }))
        .catch(error => { this.output = undefined; throw error; });
    }
    return this.output;
  }

  clear(): void {
    this.input = undefined;
    this.timestep = undefined;
    this.output = undefined;
  }
}

