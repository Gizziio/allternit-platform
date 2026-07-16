export function bfloat16ToFloat32(source: ArrayBuffer): Float32Array {
  if (source.byteLength % 2 !== 0) throw new Error("BF16 data length must be divisible by two");
  const input = new Uint16Array(source);
  const bits = new Uint32Array(input.length);
  for (let index = 0; index < input.length; index += 1) bits[index] = input[index] << 16;
  return new Float32Array(bits.buffer);
}

export function alignTo(value: number, alignment: number): number {
  if (!Number.isInteger(value) || value < 0 || !Number.isInteger(alignment) || alignment <= 0) {
    throw new Error("Alignment inputs must be non-negative integers with a positive alignment");
  }
  return Math.ceil(value / alignment) * alignment;
}

export function packedAffineMatmulCpu(
  input: Float32Array,
  batchRows: number,
  packedWeights: Uint32Array,
  outputColumns: number,
  inner: number,
  groupSize: number,
  scales: Float32Array,
  biases: Float32Array,
): Float32Array {
  if (input.length !== batchRows * inner || inner % groupSize !== 0) throw new Error("CPU affine matmul shape mismatch");
  const packedPerRow = Math.ceil(inner / 16);
  const groupsPerRow = inner / groupSize;
  if (packedWeights.length !== outputColumns * packedPerRow ||
      scales.length !== outputColumns * groupsPerRow || biases.length !== scales.length) {
    throw new Error("CPU affine matmul weight shape mismatch");
  }
  const output = new Float32Array(batchRows * outputColumns);
  for (let row = 0; row < batchRows; row += 1) {
    for (let column = 0; column < outputColumns; column += 1) {
      let sum = 0;
      for (let innerIndex = 0; innerIndex < inner; innerIndex += 1) {
        const word = packedWeights[column * packedPerRow + Math.floor(innerIndex / 16)];
        const code = (word >>> ((innerIndex % 16) * 2)) & 3;
        if (code === 3) throw new Error("Invalid ternary code 3 in packed weight");
        const group = column * groupsPerRow + Math.floor(innerIndex / groupSize);
        sum += input[row * inner + innerIndex] * (code * scales[group] + biases[group]);
      }
      output[row * outputColumns + column] = sum;
    }
  }
  return output;
}

export function onlineAttentionCpu(
  query: Float32Array,
  key: Float32Array,
  value: Float32Array,
  queryLength: number,
  keyLength: number,
  headDimensions: number,
): Float32Array {
  if (query.length !== queryLength * headDimensions || key.length !== keyLength * headDimensions || value.length !== key.length) {
    throw new Error("CPU attention shape mismatch");
  }
  const output = new Float32Array(query.length);
  const scale = 1 / Math.sqrt(headDimensions);
  for (let queryToken = 0; queryToken < queryLength; queryToken += 1) {
    let runningMax = Number.NEGATIVE_INFINITY;
    let denominator = 0;
    const accumulator = new Float64Array(headDimensions);
    for (let keyToken = 0; keyToken < keyLength; keyToken += 1) {
      let score = 0;
      for (let dimension = 0; dimension < headDimensions; dimension += 1) {
        score += query[queryToken * headDimensions + dimension] * key[keyToken * headDimensions + dimension];
      }
      score *= scale;
      const nextMax = Math.max(runningMax, score);
      const previousWeight = Math.exp(runningMax - nextMax);
      const currentWeight = Math.exp(score - nextMax);
      for (let dimension = 0; dimension < headDimensions; dimension += 1) {
        accumulator[dimension] = accumulator[dimension] * previousWeight +
          currentWeight * value[keyToken * headDimensions + dimension];
      }
      denominator = denominator * previousWeight + currentWeight;
      runningMax = nextMax;
    }
    for (let dimension = 0; dimension < headDimensions; dimension += 1) {
      output[queryToken * headDimensions + dimension] = accumulator[dimension] / denominator;
    }
  }
  return output;
}
