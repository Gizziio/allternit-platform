export const BONSAI_MODEL_REPOSITORY = "prism-ml/bonsai-image-ternary-4B-mlx-2bit";
export const BONSAI_MODEL_REVISION = "2c24c81b934a658ba5590cf39088ba929985b4a8";

export const BONSAI_TRANSFORMER = {
  path: "transformer-packed-mflux/diffusion_pytorch_model.safetensors",
  bytes: 1_425_271_472,
  sha256: "b21737bdf02690b7d662907781c4dc8b8bf22a2c98b823b1ca3336f48371a84f",
  doubleStreamBlocks: 5,
  singleStreamBlocks: 20,
  attentionHeads: 24,
  attentionHeadDimensions: 128,
  inputChannels: 128,
  jointAttentionDimensions: 7680,
} as const;

export const BONSAI_TEXT_ENCODER = {
  path: "text_encoder-mlx-4bit/model.safetensors",
  bytes: 2_263_022_529,
  sha256: "e240c0bdc0ebb0681bf0da0f98d9719fd6ebe269a3633f81542c13e81345651d",
  headerBytes: 102_329,
  tensors: 904,
  hiddenDimensions: 2560,
  intermediateDimensions: 9728,
  layers: 36,
  attentionHeads: 32,
  keyValueHeads: 8,
  headDimensions: 128,
  vocabulary: 151_936,
  bits: 4,
  groupSize: 64,
  ropeTheta: 1_000_000,
  rmsNormEpsilon: 1e-6,
  outputLayers: [9, 18, 27] as const,
} as const;

export const BONSAI_VAE = {
  path: "vae/diffusion_pytorch_model.safetensors",
  bytes: 168_120_878,
  sha256: "ca70d2202afe6415bdbcb8793ba8cd99fd159cfe6192381504d6c4d3036e0f04",
  headerBytes: 28_120,
  tensors: 251,
  latentChannels: 32,
  blockChannels: [128, 256, 512, 512] as const,
  batchNormEpsilon: 1e-4,
} as const;

export const BONSAI_PINNED_ARTIFACT_BYTES = 3_888_274_639;

export const BONSAI_QUANTIZATION = {
  format: "mlx-packed-affine",
  solver: "ternary",
  bits: 2,
  groupSize: 128,
  scaleDtype: "BF16",
  quantizedLinearCount: 100,
} as const;

export function huggingFaceResolveUrl(path: string): string {
  return `https://huggingface.co/${BONSAI_MODEL_REPOSITORY}/resolve/${BONSAI_MODEL_REVISION}/${path}`;
}
