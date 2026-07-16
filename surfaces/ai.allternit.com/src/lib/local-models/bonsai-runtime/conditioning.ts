import { DenseLinear } from "./dense-linear";
import { GpuBufferArena } from "./gpu-buffer-arena";
import type { LoadedDenseTensor } from "./packed-affine-loader";
import type { SingleBlockConditioning } from "./single-block-executor";
import { KLEIN_TRANSFORMER_SPEC } from "./transformer-spec";

export interface TimestepWeights {
  linear1: LoadedDenseTensor;
  linear2: LoadedDenseTensor;
}

export interface PreparedTimestep {
  embedding: GPUBuffer;
  arena: GpuBufferArena;
}

export interface PreparedSingleConditioning extends SingleBlockConditioning {
  modulation: GPUBuffer;
  arena: GpuBufferArena;
}

export interface ModulationTriple {
  shift: GPUBufferBinding;
  scale: GPUBufferBinding;
  gate: GPUBufferBinding;
}

export interface PreparedDoubleConditioning {
  image: [ModulationTriple, ModulationTriple];
  text: [ModulationTriple, ModulationTriple];
  imageModulation: GPUBuffer;
  textModulation: GPUBuffer;
  arena: GpuBufferArena;
}

export interface PreparedFinalConditioning {
  scale: GPUBufferBinding;
  shift: GPUBufferBinding;
  modulation: GPUBuffer;
  arena: GpuBufferArena;
}

export function timestepEmbedding(timestep: number, dimensions = 256): Float32Array {
  if (!Number.isFinite(timestep)) throw new Error("Timestep must be finite");
  const scaled = timestep <= 1 ? timestep * 1000 : timestep;
  const half = Math.floor(dimensions / 2);
  const output = new Float32Array(dimensions);
  for (let index = 0; index < half; index += 1) {
    const angle = scaled * Math.exp(-Math.log(10_000) * index / half);
    output[index] = Math.cos(angle);
    output[half + index] = Math.sin(angle);
  }
  return output;
}

export class BonsaiConditioningBuilder {
  private readonly dense: DenseLinear;

  constructor(private readonly device: GPUDevice) {
    this.dense = new DenseLinear(device);
  }

  prepareTimestep(timestep: number, weights: TimestepWeights): PreparedTimestep {
    const width = KLEIN_TRANSFORMER_SPEC.dimensions;
    DenseLinear.validateWeight(weights.linear1, width, 256);
    DenseLinear.validateWeight(weights.linear2, width, width);
    const arena = new GpuBufferArena(this.device);
    try {
      const input = arena.upload(timestepEmbedding(timestep), undefined, "bonsai-timestep-fourier");
      const firstWeight = arena.upload(weights.linear1.values, undefined, "bonsai-timestep-linear-1-weight");
      const secondWeight = arena.upload(weights.linear2.values, undefined, "bonsai-timestep-linear-2-weight");
      const first = arena.create(width * 4, undefined, "bonsai-timestep-linear-1");
      const embedding = arena.create(width * 4, undefined, "bonsai-timestep-embedding");
      const firstShape = arena.uniform([1, width, 256, 0]);
      const secondShape = arena.uniform([1, width, width, 1]);
      const encoder = this.device.createCommandEncoder({ label: "bonsai-owned-timestep-conditioning" });
      this.dense.encode(encoder, input, firstWeight, first, firstShape, 1, width);
      this.dense.encode(encoder, first, secondWeight, embedding, secondShape, 1, width);
      this.device.queue.submit([encoder.finish()]);
      return { embedding, arena };
    } catch (error) {
      arena.destroy();
      throw error;
    }
  }

  prepareSingle(embedding: GPUBuffer, modulationWeight: LoadedDenseTensor, rope: GPUBuffer,
    arena = new GpuBufferArena(this.device)): PreparedSingleConditioning {
    const width = KLEIN_TRANSFORMER_SPEC.dimensions;
    DenseLinear.validateWeight(modulationWeight, width * 3, width);
    const weight = arena.upload(modulationWeight.values, undefined, "bonsai-single-modulation-weight");
    const modulation = arena.create(width * 3 * 4, undefined, "bonsai-single-modulation");
    const shape = arena.uniform([1, width * 3, width, 1]);
    const encoder = this.device.createCommandEncoder({ label: "bonsai-owned-single-modulation" });
    this.dense.encode(encoder, embedding, weight, modulation, shape, 1, width * 3);
    this.device.queue.submit([encoder.finish()]);
    const bytes = width * 4;
    return {
      modulation,
      shift: { buffer: modulation, offset: 0, size: bytes },
      scale: { buffer: modulation, offset: bytes, size: bytes },
      gate: { buffer: modulation, offset: bytes * 2, size: bytes },
      rope,
      arena,
    };
  }

  async prepareDouble(embedding: GPUBuffer, imageWeight: LoadedDenseTensor,
    textWeight: LoadedDenseTensor): Promise<PreparedDoubleConditioning> {
    const width = KLEIN_TRANSFORMER_SPEC.dimensions;
    const outputWidth = width * 6;
    DenseLinear.validateWeight(imageWeight, outputWidth, width);
    DenseLinear.validateWeight(textWeight, outputWidth, width);
    const arena = new GpuBufferArena(this.device);
    try {
      const imageModulation = arena.create(outputWidth * 4, undefined, "bonsai-double-image-modulation");
      const textModulation = arena.create(outputWidth * 4, undefined, "bonsai-double-text-modulation");
      const encoder = this.device.createCommandEncoder({ label: "bonsai-owned-double-modulation" });
      const temporary: GPUBuffer[] = [];
      for (const [source, destination, label] of [[imageWeight, imageModulation, "image"],
        [textWeight, textModulation, "text"]] as const) {
        for (let start = 0; start < outputWidth; start += 8192) {
          const rows = Math.min(8192, outputWidth - start);
          const values = source.values.subarray(start * width, (start + rows) * width);
          const weight = arena.upload(values, undefined, `bonsai-double-${label}-modulation-weight-${start}`);
          const chunk = arena.create(rows * 4, undefined, `bonsai-double-${label}-modulation-${start}`);
          const shape = arena.uniform([1, rows, width, 1]);
          temporary.push(weight, chunk, shape);
          this.dense.encode(encoder, embedding, weight, chunk, shape, 1, rows);
          encoder.copyBufferToBuffer(chunk, 0, destination, start * 4, rows * 4);
        }
      }
      this.device.queue.submit([encoder.finish()]);
      await this.device.queue.onSubmittedWorkDone();
      temporary.forEach(buffer => arena.release(buffer));
      return {
        image: modulationPair(imageModulation, width),
        text: modulationPair(textModulation, width),
        imageModulation,
        textModulation,
        arena,
      };
    } catch (error) {
      arena.destroy();
      throw error;
    }
  }

  prepareFinal(embedding: GPUBuffer, finalWeight: LoadedDenseTensor): PreparedFinalConditioning {
    const width = KLEIN_TRANSFORMER_SPEC.dimensions;
    DenseLinear.validateWeight(finalWeight, width * 2, width);
    const arena = new GpuBufferArena(this.device);
    try {
      const weight = arena.upload(finalWeight.values, undefined, "bonsai-final-modulation-weight");
      const modulation = arena.create(width * 2 * 4, undefined, "bonsai-final-modulation");
      const shape = arena.uniform([1, width * 2, width, 1]);
      const encoder = this.device.createCommandEncoder({ label: "bonsai-owned-final-modulation" });
      this.dense.encode(encoder, embedding, weight, modulation, shape, 1, width * 2);
      this.device.queue.submit([encoder.finish()]);
      const bytes = width * 4;
      // AdaLayerNormContinuous emits [scale, shift], unlike block modulation.
      return {
        scale: { buffer: modulation, offset: 0, size: bytes },
        shift: { buffer: modulation, offset: bytes, size: bytes },
        modulation,
        arena,
      };
    } catch (error) {
      arena.destroy();
      throw error;
    }
  }
}

function modulationPair(buffer: GPUBuffer, width: number): [ModulationTriple, ModulationTriple] {
  const bytes = width * 4;
  const triple = (set: number): ModulationTriple => ({
    shift: { buffer, offset: (set * 3) * bytes, size: bytes },
    scale: { buffer, offset: (set * 3 + 1) * bytes, size: bytes },
    gate: { buffer, offset: (set * 3 + 2) * bytes, size: bytes },
  });
  return [triple(0), triple(1)];
}
