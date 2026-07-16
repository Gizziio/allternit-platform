export const QWEN_KERNELS_WGSL = /* wgsl */ `
struct Dimensions { rows: u32, width: u32, heads: u32, epsilon_bits: u32 }

@group(0) @binding(0) var<storage, read> input_values: array<f32>;
@group(0) @binding(1) var<storage, read> parameter_a: array<f32>;
@group(0) @binding(2) var<storage, read> parameter_b: array<f32>;
@group(0) @binding(3) var<storage, read_write> output_values: array<f32>;
@group(0) @binding(4) var<uniform> dimensions: Dimensions;
var<workgroup> partial: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn rms_norm(@builtin(workgroup_id) group: vec3<u32>, @builtin(local_invocation_id) local: vec3<u32>) {
  let row = group.x;
  let lane = local.x;
  if (row >= dimensions.rows) { return; }
  var square_sum = 0.0;
  for (var column = lane; column < dimensions.width; column += 256u) {
    let value = input_values[row * dimensions.width + column];
    square_sum += value * value;
  }
  partial[lane] = square_sum;
  workgroupBarrier();
  for (var stride = 128u; stride > 0u; stride >>= 1u) {
    if (lane < stride) { partial[lane] += partial[lane + stride]; }
    workgroupBarrier();
  }
  let inverse_rms = inverseSqrt(partial[0] / f32(dimensions.width) + bitcast<f32>(dimensions.epsilon_bits));
  for (var column = lane; column < dimensions.width; column += 256u) {
    output_values[row * dimensions.width + column] = input_values[row * dimensions.width + column] *
      inverse_rms * parameter_a[column];
  }
}

// Input is row-major [token, head, 128]; output is [head, token, 128]. Qwen
// uses rotate-half rather than adjacent-pair rotary embedding.
@compute @workgroup_size(128, 1, 1)
fn rms_norm_rope(@builtin(workgroup_id) group: vec3<u32>, @builtin(local_invocation_id) local: vec3<u32>) {
  let token = group.x;
  let head = group.y;
  let lane = local.x;
  if (token >= dimensions.rows || head >= dimensions.heads || dimensions.width != 128u) { return; }
  let input_base = (token * dimensions.heads + head) * 128u;
  let value = input_values[input_base + lane];
  partial[lane] = value * value;
  workgroupBarrier();
  for (var stride = 64u; stride > 0u; stride >>= 1u) {
    if (lane < stride) { partial[lane] += partial[lane + stride]; }
    workgroupBarrier();
  }
  partial[lane] = value * inverseSqrt(partial[0] / 128.0 + bitcast<f32>(dimensions.epsilon_bits)) * parameter_a[lane];
  workgroupBarrier();
  var rotated = 0.0;
  if (lane < 64u) { rotated = -partial[lane + 64u]; }
  else { rotated = partial[lane - 64u]; }
  let cos_value = parameter_b[token * 256u + lane];
  let sin_value = parameter_b[token * 256u + 128u + lane];
  output_values[(head * dimensions.rows + token) * 128u + lane] = partial[lane] * cos_value + rotated * sin_value;
}

@compute @workgroup_size(256, 1, 1)
fn silu_multiply(@builtin(global_invocation_id) id: vec3<u32>) {
  let count = dimensions.rows * dimensions.width;
  if (id.x >= count) { return; }
  let gate = input_values[id.x];
  output_values[id.x] = gate / (1.0 + exp(-gate)) * parameter_a[id.x];
}

@compute @workgroup_size(256, 1, 1)
fn concat_three(@builtin(global_invocation_id) id: vec3<u32>) {
  let count = dimensions.rows * dimensions.width * 3u;
  if (id.x >= count) { return; }
  let row = id.x / (dimensions.width * 3u);
  let column = id.x % (dimensions.width * 3u);
  let source_column = column % dimensions.width;
  let source_index = row * dimensions.width + source_column;
  if (column < dimensions.width) { output_values[id.x] = input_values[source_index]; }
  else if (column < dimensions.width * 2u) { output_values[id.x] = parameter_a[source_index]; }
  else { output_values[id.x] = parameter_b[source_index]; }
}
`;

export const QWEN_CAUSAL_ATTENTION_WGSL = /* wgsl */ `
struct AttentionDimensions { sequence: u32, query_heads: u32, kv_heads: u32, head_dim: u32, valid_tokens: u32 }
@group(0) @binding(0) var<storage, read> query: array<f32>;
@group(0) @binding(1) var<storage, read> key: array<f32>;
@group(0) @binding(2) var<storage, read> value: array<f32>;
@group(0) @binding(3) var<storage, read_write> output: array<f32>;
@group(0) @binding(4) var<uniform> dims: AttentionDimensions;
var<workgroup> dot_parts: array<f32, 128>;

@compute @workgroup_size(128, 1, 1)
fn main(@builtin(workgroup_id) group: vec3<u32>, @builtin(local_invocation_id) local: vec3<u32>) {
  let token = group.x;
  let query_head = group.y;
  let lane = local.x;
  if (token >= dims.sequence || query_head >= dims.query_heads || dims.head_dim != 128u) { return; }
  let kv_head = query_head / (dims.query_heads / dims.kv_heads);
  let q = query[(query_head * dims.sequence + token) * 128u + lane];
  var running_max = -3.402823466e+38;
  var denominator = 0.0;
  var accumulator = 0.0;
  let last_key = min(token + 1u, dims.valid_tokens);
  for (var key_token = 0u; key_token < last_key; key_token += 1u) {
    dot_parts[lane] = q * key[(kv_head * dims.sequence + key_token) * 128u + lane];
    workgroupBarrier();
    for (var stride = 64u; stride > 0u; stride >>= 1u) {
      if (lane < stride) { dot_parts[lane] += dot_parts[lane + stride]; }
      workgroupBarrier();
    }
    let score = dot_parts[0] * inverseSqrt(128.0);
    let next_max = max(running_max, score);
    let old_weight = exp(running_max - next_max);
    let new_weight = exp(score - next_max);
    accumulator = accumulator * old_weight + new_weight * value[(kv_head * dims.sequence + key_token) * 128u + lane];
    denominator = denominator * old_weight + new_weight;
    running_max = next_max;
    workgroupBarrier();
  }
  output[(query_head * dims.sequence + token) * 128u + lane] = accumulator / denominator;
}
`;

export const PACKED_EMBEDDING_WGSL = /* wgsl */ `
struct EmbeddingDimensions { sequence: u32, width: u32, group_size: u32, bits: u32 }
@group(0) @binding(0) var<storage, read> token_ids: array<u32>;
@group(0) @binding(1) var<storage, read> packed: array<u32>;
@group(0) @binding(2) var<storage, read> scales: array<f32>;
@group(0) @binding(3) var<storage, read> biases: array<f32>;
@group(0) @binding(4) var<storage, read_write> output: array<f32>;
@group(0) @binding(5) var<uniform> dims: EmbeddingDimensions;
@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  if (index >= dims.sequence * dims.width) { return; }
  let token = index / dims.width;
  let column = index % dims.width;
  let row = token_ids[token];
  let codes_per_word = 32u / dims.bits;
  let packed_width = (dims.width + codes_per_word - 1u) / codes_per_word;
  let word = packed[row * packed_width + column / codes_per_word];
  let code = (word >> ((column % codes_per_word) * dims.bits)) & ((1u << dims.bits) - 1u);
  let groups_per_row = (dims.width + dims.group_size - 1u) / dims.group_size;
  let group = row * groups_per_row + column / dims.group_size;
  output[index] = f32(code) * scales[group] + biases[group];
}
`;
