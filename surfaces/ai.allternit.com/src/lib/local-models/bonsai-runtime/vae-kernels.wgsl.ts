export const VAE_CONVOLUTION_WGSL = /* wgsl */ `
struct ConvDimensions { input_h: u32, input_w: u32, input_c: u32, output_c: u32, kernel: u32, padding: u32, upsample: u32, output_h: u32 }
@group(0) @binding(0) var<storage, read> input_values: array<f32>;
@group(0) @binding(1) var<storage, read> weights: array<f32>;
@group(0) @binding(2) var<storage, read> biases: array<f32>;
@group(0) @binding(3) var<storage, read_write> output_values: array<f32>;
@group(0) @binding(4) var<uniform> dims: ConvDimensions;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let output_w = select(dims.input_w, dims.input_w * 2u, dims.upsample != 0u);
  let x = id.x; let y = id.y; let output_channel = id.z;
  if (x >= output_w || y >= dims.output_h || output_channel >= dims.output_c) { return; }
  var sum = biases[output_channel];
  for (var ky = 0u; ky < dims.kernel; ky += 1u) {
    for (var kx = 0u; kx < dims.kernel; kx += 1u) {
      let source_y = i32(y) + i32(ky) - i32(dims.padding);
      let source_x = i32(x) + i32(kx) - i32(dims.padding);
      let expanded_h = select(dims.input_h, dims.input_h * 2u, dims.upsample != 0u);
      let expanded_w = select(dims.input_w, dims.input_w * 2u, dims.upsample != 0u);
      if (source_y < 0 || source_x < 0 || source_y >= i32(expanded_h) || source_x >= i32(expanded_w)) { continue; }
      let input_y = select(u32(source_y), u32(source_y) / 2u, dims.upsample != 0u);
      let input_x = select(u32(source_x), u32(source_x) / 2u, dims.upsample != 0u);
      for (var input_channel = 0u; input_channel < dims.input_c; input_channel += 1u) {
        let input_index = (input_y * dims.input_w + input_x) * dims.input_c + input_channel;
        let weight_index = (((output_channel * dims.input_c + input_channel) * dims.kernel + ky) * dims.kernel + kx);
        sum += input_values[input_index] * weights[weight_index];
      }
    }
  }
  output_values[(y * output_w + x) * dims.output_c + output_channel] = sum;
}
`;

export const VAE_NORMALIZATION_WGSL = /* wgsl */ `
struct NormDimensions { height: u32, width: u32, channels: u32, groups: u32, epsilon_bits: u32, activate: u32 }
@group(0) @binding(0) var<storage, read> input_values: array<f32>;
@group(0) @binding(1) var<storage, read> weights: array<f32>;
@group(0) @binding(2) var<storage, read> biases: array<f32>;
@group(0) @binding(3) var<storage, read_write> output_values: array<f32>;
@group(0) @binding(4) var<uniform> dims: NormDimensions;
var<workgroup> sums: array<f32, 256>;
var<workgroup> squares: array<f32, 256>;

fn flat_index(id: vec3<u32>, counts: vec3<u32>) -> u32 {
  return id.x + id.y * (counts.x * 256u);
}

@compute @workgroup_size(256, 1, 1)
fn group_norm(@builtin(workgroup_id) group_id: vec3<u32>, @builtin(local_invocation_id) local: vec3<u32>) {
  let group = group_id.x; let lane = local.x;
  let channels_per_group = dims.channels / dims.groups;
  let elements = dims.height * dims.width * channels_per_group;
  var sum = 0.0; var square_sum = 0.0;
  for (var index = lane; index < elements; index += 256u) {
    let spatial = index / channels_per_group; let channel = group * channels_per_group + index % channels_per_group;
    let value = input_values[spatial * dims.channels + channel]; sum += value; square_sum += value * value;
  }
  sums[lane] = sum; squares[lane] = square_sum; workgroupBarrier();
  for (var stride = 128u; stride > 0u; stride >>= 1u) {
    if (lane < stride) { sums[lane] += sums[lane + stride]; squares[lane] += squares[lane + stride]; }
    workgroupBarrier();
  }
  let mean = sums[0] / f32(elements);
  let inverse_std = inverseSqrt(max(squares[0] / f32(elements) - mean * mean, 0.0) + bitcast<f32>(dims.epsilon_bits));
  for (var index = lane; index < elements; index += 256u) {
    let spatial = index / channels_per_group; let channel = group * channels_per_group + index % channels_per_group;
    var value = (input_values[spatial * dims.channels + channel] - mean) * inverse_std * weights[channel] + biases[channel];
    if (dims.activate != 0u) { value = value / (1.0 + exp(-value)); }
    output_values[spatial * dims.channels + channel] = value;
  }
}

@compute @workgroup_size(256, 1, 1)
fn add(@builtin(global_invocation_id) id: vec3<u32>, @builtin(num_workgroups) counts: vec3<u32>) {
  let count = dims.height * dims.width * dims.channels;
  let index = flat_index(id, counts);
  if (index < count) { output_values[index] = input_values[index] + weights[index]; }
}
`;

export const VAE_UNPATCH_WGSL = /* wgsl */ `
struct UnpatchDimensions { packed_h: u32, packed_w: u32, packed_c: u32, output_c: u32 }
@group(0) @binding(0) var<storage, read> packed_values: array<f32>;
@group(0) @binding(1) var<storage, read> running_mean: array<f32>;
@group(0) @binding(2) var<storage, read> running_variance: array<f32>;
@group(0) @binding(3) var<storage, read_write> output_values: array<f32>;
@group(0) @binding(4) var<uniform> dims: UnpatchDimensions;
@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let count = dims.packed_h * dims.packed_w * dims.packed_c;
  if (id.x >= count) { return; }
  let token = id.x / dims.packed_c; let packed_channel = id.x % dims.packed_c;
  let y = token / dims.packed_w; let x = token % dims.packed_w;
  let channel = packed_channel / 4u; let patch_index = packed_channel % 4u;
  let output_y = y * 2u + patch_index / 2u; let output_x = x * 2u + patch_index % 2u;
  let value = packed_values[id.x] * sqrt(running_variance[packed_channel] + 0.0001) + running_mean[packed_channel];
  let output_w = dims.packed_w * 2u;
  output_values[(output_y * output_w + output_x) * dims.output_c + channel] = value;
}
`;

export const VAE_ATTENTION_WGSL = /* wgsl */ `
struct AttentionDimensions { sequence: u32, channels: u32, unused_a: u32, unused_b: u32 }
@group(0) @binding(0) var<storage, read> query: array<f32>;
@group(0) @binding(1) var<storage, read> key: array<f32>;
@group(0) @binding(2) var<storage, read> value: array<f32>;
@group(0) @binding(3) var<storage, read_write> output: array<f32>;
@group(0) @binding(4) var<uniform> dims: AttentionDimensions;
var<workgroup> dot_parts: array<f32, 256>;
@compute @workgroup_size(256, 1, 1)
fn main(@builtin(workgroup_id) group: vec3<u32>, @builtin(local_invocation_id) local: vec3<u32>) {
  let query_token = group.x; let lane = local.x;
  if (query_token >= dims.sequence || dims.channels != 512u) { return; }
  let q0 = query[query_token * 512u + lane]; let q1 = query[query_token * 512u + lane + 256u];
  var accumulator0 = 0.0; var accumulator1 = 0.0;
  var running_max = -3.402823466e+38; var denominator = 0.0;
  for (var key_token = 0u; key_token < dims.sequence; key_token += 1u) {
    dot_parts[lane] = q0 * key[key_token * 512u + lane] + q1 * key[key_token * 512u + lane + 256u];
    workgroupBarrier();
    for (var stride = 128u; stride > 0u; stride >>= 1u) {
      if (lane < stride) { dot_parts[lane] += dot_parts[lane + stride]; }
      workgroupBarrier();
    }
    let score = dot_parts[0] * inverseSqrt(512.0); let next_max = max(running_max, score);
    let old_weight = exp(running_max - next_max); let new_weight = exp(score - next_max);
    accumulator0 = accumulator0 * old_weight + new_weight * value[key_token * 512u + lane];
    accumulator1 = accumulator1 * old_weight + new_weight * value[key_token * 512u + lane + 256u];
    denominator = denominator * old_weight + new_weight; running_max = next_max; workgroupBarrier();
  }
  output[query_token * 512u + lane] = accumulator0 / denominator;
  output[query_token * 512u + lane + 256u] = accumulator1 / denominator;
}
`;
