import { KLEIN_TRANSFORMER_SPEC } from "./transformer-spec";

export interface RotaryEmbedding {
  sequenceLength: number;
  halfDimensions: number;
  cosine: Float32Array;
  sine: Float32Array;
}

export function flux2ImageIds(width: number, height: number): Float32Array {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 || width % 16 || height % 16) {
    throw new Error("Flux2 image dimensions must be positive multiples of 16");
  }
  const rows = height / 16;
  const columns = width / 16;
  const ids = new Float32Array(rows * columns * 4);
  let token = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      ids[token * 4 + 1] = row;
      ids[token * 4 + 2] = column;
      token += 1;
    }
  }
  return ids;
}

export function flux2TextIds(sequenceLength: number): Float32Array {
  if (!Number.isInteger(sequenceLength) || sequenceLength <= 0) throw new Error("Flux2 text sequence length must be positive");
  const ids = new Float32Array(sequenceLength * 4);
  for (let token = 0; token < sequenceLength; token += 1) ids[token * 4 + 3] = token;
  return ids;
}

export function packRotaryEmbedding(embedding: RotaryEmbedding): Float32Array {
  const packed = new Float32Array(embedding.cosine.length + embedding.sine.length);
  packed.set(embedding.cosine);
  packed.set(embedding.sine, embedding.cosine.length);
  return packed;
}

export function flux2RotaryEmbedding(
  ids: Float32Array,
  sequenceLength: number,
  axisDimensions: readonly number[] = KLEIN_TRANSFORMER_SPEC.ropeAxisDimensions,
  theta = KLEIN_TRANSFORMER_SPEC.ropeTheta,
): RotaryEmbedding {
  const axes = axisDimensions.length;
  if (ids.length !== sequenceLength * axes) throw new Error("Flux2 rotary ID shape mismatch");
  if (axisDimensions.some(dimension => dimension <= 0 || dimension % 2 !== 0)) throw new Error("Rotary axis dimensions must be positive and even");
  const halfDimensions = axisDimensions.reduce((sum, dimension) => sum + dimension / 2, 0);
  const cosine = new Float32Array(sequenceLength * halfDimensions);
  const sine = new Float32Array(cosine.length);
  for (let token = 0; token < sequenceLength; token += 1) {
    let destination = token * halfDimensions;
    for (let axis = 0; axis < axes; axis += 1) {
      const dimension = axisDimensions[axis];
      const position = ids[token * axes + axis];
      for (let pair = 0; pair < dimension / 2; pair += 1) {
        const frequency = 1 / theta ** ((pair * 2) / dimension);
        const angle = position * frequency;
        cosine[destination] = Math.cos(angle);
        sine[destination] = Math.sin(angle);
        destination += 1;
      }
    }
  }
  return { sequenceLength, halfDimensions, cosine, sine };
}

export function applyRotaryEmbedding(
  values: Float32Array,
  sequenceLength: number,
  heads: number,
  headDimensions: number,
  embedding: RotaryEmbedding,
): Float32Array {
  if (embedding.sequenceLength !== sequenceLength || embedding.halfDimensions !== headDimensions / 2 ||
      values.length !== sequenceLength * heads * headDimensions) {
    throw new Error("Rotary embedding tensor shape mismatch");
  }
  const output = new Float32Array(values.length);
  for (let token = 0; token < sequenceLength; token += 1) {
    for (let head = 0; head < heads; head += 1) {
      const valueBase = (token * heads + head) * headDimensions;
      const rotaryBase = token * embedding.halfDimensions;
      for (let pair = 0; pair < headDimensions / 2; pair += 1) {
        const real = values[valueBase + pair * 2];
        const imaginary = values[valueBase + pair * 2 + 1];
        const cosine = embedding.cosine[rotaryBase + pair];
        const sine = embedding.sine[rotaryBase + pair];
        output[valueBase + pair * 2] = real * cosine - imaginary * sine;
        output[valueBase + pair * 2 + 1] = imaginary * cosine + real * sine;
      }
    }
  }
  return output;
}
