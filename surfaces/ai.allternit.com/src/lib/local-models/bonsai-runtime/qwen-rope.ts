import { BONSAI_TEXT_ENCODER } from "./model-spec";

/** Packs per-token [cos(128), sin(128)] for Qwen3 rotate-half RoPE. */
export function qwenRotaryEmbedding(sequenceLength: number): Float32Array {
  if (!Number.isInteger(sequenceLength) || sequenceLength <= 0) throw new Error("Qwen sequence length must be positive");
  const width = BONSAI_TEXT_ENCODER.headDimensions;
  const half = width / 2;
  const output = new Float32Array(sequenceLength * width * 2);
  for (let token = 0; token < sequenceLength; token += 1) {
    for (let lane = 0; lane < width; lane += 1) {
      const pair = lane % half;
      const frequency = 1 / BONSAI_TEXT_ENCODER.ropeTheta ** ((pair * 2) / width);
      const angle = token * frequency;
      output[token * width * 2 + lane] = Math.cos(angle);
      output[token * width * 2 + width + lane] = Math.sin(angle);
    }
  }
  return output;
}

