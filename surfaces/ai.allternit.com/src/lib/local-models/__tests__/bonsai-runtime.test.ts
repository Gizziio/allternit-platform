import { describe, expect, it } from "vitest";
import {
  bfloat16ToFloat32,
  applyRotaryEmbedding,
  bonsaiImageSequenceLength,
  createFlowMatchSchedule,
  flowMatchEulerStep,
  flux2RotaryEmbedding,
  flux2ImageIds,
  flux2TextIds,
  packRotaryEmbedding,
  doubleBlockWeightKeys,
  estimateSingleBlockWorkingBytes,
  estimateTiledSingleBlockWorkingBytes,
  singleBlockTileRows,
  maximumBandRows,
  estimateDoubleBlockWorkingBytes,
  packedAffineMatmulCpu,
  onlineAttentionCpu,
  singleBlockWeightKeys,
  timestepEmbedding,
} from "../bonsai-runtime";

describe("owned Bonsai packed-affine runtime", () => {
  it("converts little-endian bfloat16 values exactly", () => {
    const values = new Uint16Array([0x3f80, 0xbf80, 0x3e80]);
    expect([...bfloat16ToFloat32(values.buffer)]).toEqual([1, -1, 0.25]);
  });

  it("maps packed ternary codes through group affine parameters", () => {
    // Repeating codes 0,1,2 map to -2,0,+2 when scale=2 and bias=-2.
    let word = 0;
    for (let index = 0; index < 16; index += 1) word |= (index % 3) << (index * 2);
    const input = new Float32Array(16).fill(1);
    const result = packedAffineMatmulCpu(
      input,
      1,
      new Uint32Array([word]),
      1,
      16,
      16,
      new Float32Array([2]),
      new Float32Array([-2]),
    );
    expect(result[0]).toBe(-2);
  });

  it("rejects the unused two-bit code", () => {
    expect(() => packedAffineMatmulCpu(
      new Float32Array(16), 1, new Uint32Array([3]), 1, 16, 16,
      new Float32Array([1]), new Float32Array([-1]),
    )).toThrow(/code 3/);
  });

  it("derives the packed latent sequence from image dimensions", () => {
    expect(bonsaiImageSequenceLength(512, 512)).toBe(1024);
    expect(bonsaiImageSequenceLength(1024, 1024)).toBe(4096);
    expect(() => bonsaiImageSequenceLength(513, 512)).toThrow(/multiples of 32/);
  });

  it("creates a descending four-step dynamic flow schedule", () => {
    const schedule = createFlowMatchSchedule(1024, 1024, 4);
    expect(schedule.imageSequenceLength).toBe(4096);
    expect(schedule.sigmas).toHaveLength(5);
    expect(schedule.sigmas[0]).toBe(1);
    expect(schedule.sigmas[4]).toBe(0);
    expect([...schedule.sigmas].every((value, index, all) => index === 0 || value < all[index - 1])).toBe(true);
  });

  it("applies the Euler update without mutating its inputs", () => {
    const sample = new Float32Array([1, 2]);
    const output = flowMatchEulerStep(sample, new Float32Array([2, -2]), 1, 0.5);
    expect([...output]).toEqual([0, 3]);
    expect([...sample]).toEqual([1, 2]);
  });

  it("maps all 25 transformer blocks to publisher tensor names", () => {
    expect(doubleBlockWeightKeys(4).textFeedForwardOutput).toBe("transformer_blocks.4.ff_context.linear_out");
    expect(singleBlockWeightKeys(19).qkvMlpProjection).toBe("single_transformer_blocks.19.attn.to_qkv_mlp_proj");
    expect(() => doubleBlockWeightKeys(5)).toThrow(/index/);
    expect(() => singleBlockWeightKeys(20)).toThrow(/index/);
  });

  it("constructs and applies four-axis Flux2 rotary embeddings", () => {
    const ids = new Float32Array([0, 0, 0, 0, 1, 0, 0, 0]);
    const embedding = flux2RotaryEmbedding(ids, 2);
    expect(embedding.halfDimensions).toBe(64);
    const values = new Float32Array(2 * 128);
    values[0] = 1;
    values[128] = 1;
    const rotated = applyRotaryEmbedding(values, 2, 1, 128, embedding);
    expect(rotated[0]).toBe(1);
    expect(rotated[128]).toBeCloseTo(Math.cos(1), 6);
    expect(rotated[129]).toBeCloseTo(Math.sin(1), 6);
  });

  it("matches pinned Flux2 image and text coordinate ordering", () => {
    expect([...flux2ImageIds(32, 32)]).toEqual([
      0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 1, 0,
    ]);
    expect([...flux2TextIds(3)]).toEqual([0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2]);
    const embedding = flux2RotaryEmbedding(flux2TextIds(1), 1);
    const packed = packRotaryEmbedding(embedding);
    expect(packed.length).toBe(128);
    expect([...packed.slice(0, 64)].every(value => value === 1)).toBe(true);
    expect([...packed.slice(64)].every(value => value === 0)).toBe(true);
  });

  it("computes exact attention with online softmax and no score matrix", () => {
    const result = onlineAttentionCpu(
      new Float32Array([1, 0]),
      new Float32Array([1, 0, 0, 1]),
      new Float32Array([2, 4, 6, 8]),
      1,
      2,
      2,
    );
    const firstWeight = Math.exp(1 / Math.sqrt(2));
    const denominator = firstWeight + 1;
    expect(result[0]).toBeCloseTo((2 * firstWeight + 6) / denominator, 5);
    expect(result[1]).toBeCloseTo((4 * firstWeight + 8) / denominator, 5);
  });

  it("bounds single-block activation memory before GPU allocation", () => {
    expect(estimateSingleBlockWorkingBytes(1)).toBe(380_928);
    expect(estimateSingleBlockWorkingBytes(4096)).toBe(1_560_281_088);
  });

  it("tiles the 1024px single-stream projection below a 128 MiB binding", () => {
    const rows = 4096 + 512;
    const tileRows = singleBlockTileRows(128 * 1024 * 1024, rows);
    expect(tileRows).toBe(1213);
    expect(tileRows * 27_648 * 4).toBeLessThan(128 * 1024 * 1024);
    expect(estimateTiledSingleBlockWorkingBytes(rows, tileRows)).toBe(912_052_224);
  });

  it("keeps 1024px VAE bands below the storage binding limit", () => {
    expect(maximumBandRows(512, 512)).toBe(64);
    expect(maximumBandRows(1024, 256)).toBe(64);
    expect(maximumBandRows(1024, 128)).toBe(128);
    expect(maximumBandRows(1024, 256) * 1024 * 256 * 4).toBe(64 * 1024 * 1024);
  });

  it("bounds double-block activation memory before GPU allocation", () => {
    expect(estimateDoubleBlockWorkingBytes(1024, 512)).toBe(490_733_568);
  });

  it("matches the pinned flipped sinusoidal timestep embedding", () => {
    const zero = timestepEmbedding(0);
    expect([...zero.slice(0, 128)].every(value => value === 1)).toBe(true);
    expect([...zero.slice(128)].every(value => value === 0)).toBe(true);
    const scaled = timestepEmbedding(1);
    expect(scaled[0]).toBeCloseTo(Math.cos(1000), 6);
    expect(scaled[128]).toBeCloseTo(Math.sin(1000), 6);
  });
});
