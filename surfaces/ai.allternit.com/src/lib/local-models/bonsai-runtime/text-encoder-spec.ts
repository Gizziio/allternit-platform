import { BONSAI_TEXT_ENCODER } from "./model-spec";

export interface QwenLayerWeightKeys {
  inputNorm: string;
  query: string;
  key: string;
  value: string;
  queryNorm: string;
  keyNorm: string;
  attentionOutput: string;
  postAttentionNorm: string;
  gate: string;
  up: string;
  down: string;
}

export function qwenLayerWeightKeys(index: number): QwenLayerWeightKeys {
  if (!Number.isInteger(index) || index < 0 || index >= BONSAI_TEXT_ENCODER.layers) {
    throw new Error(`Invalid Qwen3 layer index: ${index}`);
  }
  const layer = `model.layers.${index}`;
  return {
    inputNorm: `${layer}.input_layernorm.weight`,
    query: `${layer}.self_attn.q_proj`,
    key: `${layer}.self_attn.k_proj`,
    value: `${layer}.self_attn.v_proj`,
    queryNorm: `${layer}.self_attn.q_norm.weight`,
    keyNorm: `${layer}.self_attn.k_norm.weight`,
    attentionOutput: `${layer}.self_attn.o_proj`,
    postAttentionNorm: `${layer}.post_attention_layernorm.weight`,
    gate: `${layer}.mlp.gate_proj`,
    up: `${layer}.mlp.up_proj`,
    down: `${layer}.mlp.down_proj`,
  };
}

export const QWEN_EMBEDDING_KEY = "model.embed_tokens";
export const QWEN_FINAL_NORM_KEY = "model.norm.weight";

