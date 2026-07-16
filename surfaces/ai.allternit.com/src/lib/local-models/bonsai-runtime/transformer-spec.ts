export const KLEIN_TRANSFORMER_SPEC = {
  dimensions: 3072,
  heads: 24,
  headDimensions: 128,
  mlpRatio: 3,
  mlpDimensions: 9216,
  inputChannels: 128,
  contextDimensions: 7680,
  doubleBlocks: 5,
  singleBlocks: 20,
  layerNormEpsilon: 1e-6,
  rmsNormEpsilon: 1e-6,
  ropeTheta: 2000,
  ropeAxisDimensions: [32, 32, 32, 32] as const,
} as const;

export interface SingleBlockWeightKeys {
  modulation: string;
  qkvMlpProjection: string;
  outputProjection: string;
  queryNorm: string;
  keyNorm: string;
}

export interface DoubleBlockWeightKeys {
  imageModulation: string;
  textModulation: string;
  imageQuery: string;
  imageKey: string;
  imageValue: string;
  textQuery: string;
  textKey: string;
  textValue: string;
  imageAttentionOutput: string;
  textAttentionOutput: string;
  imageFeedForwardInput: string;
  imageFeedForwardOutput: string;
  textFeedForwardInput: string;
  textFeedForwardOutput: string;
  imageQueryNorm: string;
  imageKeyNorm: string;
  textQueryNorm: string;
  textKeyNorm: string;
}

export function singleBlockWeightKeys(index: number): SingleBlockWeightKeys {
  if (!Number.isInteger(index) || index < 0 || index >= KLEIN_TRANSFORMER_SPEC.singleBlocks) {
    throw new Error(`Invalid Klein single-block index: ${index}`);
  }
  const attention = `single_transformer_blocks.${index}.attn`;
  return {
    modulation: "single_stream_modulation.linear.weight",
    qkvMlpProjection: `${attention}.to_qkv_mlp_proj`,
    outputProjection: `${attention}.to_out`,
    queryNorm: `${attention}.norm_q.weight`,
    keyNorm: `${attention}.norm_k.weight`,
  };
}

export function doubleBlockWeightKeys(index: number): DoubleBlockWeightKeys {
  if (!Number.isInteger(index) || index < 0 || index >= KLEIN_TRANSFORMER_SPEC.doubleBlocks) {
    throw new Error(`Invalid Klein double-block index: ${index}`);
  }
  const block = `transformer_blocks.${index}`;
  const attention = `${block}.attn`;
  return {
    imageModulation: "double_stream_modulation_img.linear.weight",
    textModulation: "double_stream_modulation_txt.linear.weight",
    imageQuery: `${attention}.to_q`,
    imageKey: `${attention}.to_k`,
    imageValue: `${attention}.to_v`,
    textQuery: `${attention}.add_q_proj`,
    textKey: `${attention}.add_k_proj`,
    textValue: `${attention}.add_v_proj`,
    imageAttentionOutput: `${attention}.to_out.0`,
    textAttentionOutput: `${attention}.to_add_out`,
    imageFeedForwardInput: `${block}.ff.linear_in`,
    imageFeedForwardOutput: `${block}.ff.linear_out`,
    textFeedForwardInput: `${block}.ff_context.linear_in`,
    textFeedForwardOutput: `${block}.ff_context.linear_out`,
    imageQueryNorm: `${attention}.norm_q.weight`,
    imageKeyNorm: `${attention}.norm_k.weight`,
    textQueryNorm: `${attention}.norm_added_q.weight`,
    textKeyNorm: `${attention}.norm_added_k.weight`,
  };
}

export const KLEIN_DENSE_WEIGHT_KEYS = {
  imageEmbedder: "x_embedder.weight",
  contextEmbedder: "context_embedder.weight",
  timeEmbedderLinear1: "time_guidance_embed.timestep_embedder.linear_1.weight",
  timeEmbedderLinear2: "time_guidance_embed.timestep_embedder.linear_2.weight",
  finalModulation: "norm_out.linear.weight",
  outputProjection: "proj_out.weight",
} as const;
