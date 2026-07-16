/** Memory-bounded exact scaled dot-product attention for Klein's 128-wide heads. */
export const ONLINE_ATTENTION_WGSL = /* wgsl */ `
struct AttentionDimensions {
  query_length: u32,
  key_length: u32,
  heads: u32,
  head_dim: u32,
}

@group(0) @binding(0) var<storage, read> query: array<f32>;
@group(0) @binding(1) var<storage, read> key: array<f32>;
@group(0) @binding(2) var<storage, read> value: array<f32>;
@group(0) @binding(3) var<storage, read_write> output: array<f32>;
@group(0) @binding(4) var<uniform> dims: AttentionDimensions;

var<workgroup> dot_parts: array<f32, 128>;

fn tensor_index(batch: u32, head: u32, token: u32, dimension: u32, length: u32) -> u32 {
  return (((batch * dims.heads + head) * length + token) * dims.head_dim) + dimension;
}

@compute @workgroup_size(128, 1, 1)
fn main(
  @builtin(workgroup_id) group: vec3<u32>,
  @builtin(local_invocation_id) local: vec3<u32>,
) {
  let query_token = group.x;
  let head = group.y;
  let batch = group.z;
  let dimension = local.x;
  if (query_token >= dims.query_length || head >= dims.heads || dims.head_dim != 128u) { return; }

  let q = query[tensor_index(batch, head, query_token, dimension, dims.query_length)];
  var running_max = -3.402823466e+38;
  var denominator = 0.0;
  var accumulator = 0.0;
  let scale = inverseSqrt(f32(dims.head_dim));

  for (var key_token = 0u; key_token < dims.key_length; key_token += 1u) {
    dot_parts[dimension] = q * key[tensor_index(batch, head, key_token, dimension, dims.key_length)];
    workgroupBarrier();
    for (var stride = 64u; stride > 0u; stride >>= 1u) {
      if (dimension < stride) { dot_parts[dimension] += dot_parts[dimension + stride]; }
      workgroupBarrier();
    }

    let score = dot_parts[0] * scale;
    let next_max = max(running_max, score);
    let previous_weight = exp(running_max - next_max);
    let current_weight = exp(score - next_max);
    accumulator = accumulator * previous_weight +
      current_weight * value[tensor_index(batch, head, key_token, dimension, dims.key_length)];
    denominator = denominator * previous_weight + current_weight;
    running_max = next_max;
    workgroupBarrier();
  }

  output[tensor_index(batch, head, query_token, dimension, dims.query_length)] = accumulator / denominator;
}
`;
