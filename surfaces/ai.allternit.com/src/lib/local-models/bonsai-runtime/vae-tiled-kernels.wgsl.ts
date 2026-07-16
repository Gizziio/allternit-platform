export const VAE_TILED_STATS_WGSL = /* wgsl */ `
struct StatsDims { height: u32, width: u32, channels: u32, groups: u32 }
@group(0) @binding(0) var<storage, read> input_values: array<f32>;
@group(0) @binding(1) var<storage, read_write> partials: array<f32>;
@group(0) @binding(2) var<uniform> dims: StatsDims;
var<workgroup> sums: array<f32, 256>;
var<workgroup> squares: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(workgroup_id) workgroup: vec3<u32>, @builtin(local_invocation_id) local: vec3<u32>) {
  let group = workgroup.x;
  let lane = local.x;
  let channels_per_group = dims.channels / dims.groups;
  let count = dims.height * dims.width * channels_per_group;
  var sum = 0.0;
  var square_sum = 0.0;
  for (var index = lane; index < count; index += 256u) {
    let spatial = index / channels_per_group;
    let channel = group * channels_per_group + index % channels_per_group;
    let value = input_values[spatial * dims.channels + channel];
    sum += value;
    square_sum += value * value;
  }
  sums[lane] = sum;
  squares[lane] = square_sum;
  workgroupBarrier();
  for (var stride = 128u; stride > 0u; stride >>= 1u) {
    if (lane < stride) {
      sums[lane] += sums[lane + stride];
      squares[lane] += squares[lane + stride];
    }
    workgroupBarrier();
  }
  if (lane == 0u) {
    partials[group] = sums[0];
    partials[dims.groups + group] = squares[0];
  }
}
`;

export const VAE_TILED_NORMALIZE_WGSL = /* wgsl */ `
struct NormalizeDims { height: u32, width: u32, channels: u32, groups: u32, activate: u32 }
@group(0) @binding(0) var<storage, read> input_values: array<f32>;
@group(0) @binding(1) var<storage, read> weights: array<f32>;
@group(0) @binding(2) var<storage, read> biases: array<f32>;
// Per group: mean followed by inverse standard deviation.
@group(0) @binding(3) var<storage, read> statistics: array<f32>;
@group(0) @binding(4) var<storage, read_write> output_values: array<f32>;
@group(0) @binding(5) var<uniform> dims: NormalizeDims;

@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let count = dims.height * dims.width * dims.channels;
  if (id.x >= count) { return; }
  let channel = id.x % dims.channels;
  let group = channel / (dims.channels / dims.groups);
  var value = (input_values[id.x] - statistics[group]) * statistics[dims.groups + group];
  value = value * weights[channel] + biases[channel];
  if (dims.activate != 0u) { value = value / (1.0 + exp(-value)); }
  output_values[id.x] = value;
}
`;

export const VAE_TILED_CONVOLUTION_WGSL = /* wgsl */ `
struct BandDims {
  full_input_h: u32, input_w: u32, input_c: u32, output_c: u32,
  kernel: u32, padding: u32, upsample: u32, current_start: u32,
  current_h: u32, previous_start: u32, previous_h: u32, next_start: u32,
  next_h: u32, output_start: u32, output_h: u32, unused: u32,
}
@group(0) @binding(0) var<storage, read> previous_values: array<f32>;
@group(0) @binding(1) var<storage, read> current_values: array<f32>;
@group(0) @binding(2) var<storage, read> next_values: array<f32>;
@group(0) @binding(3) var<storage, read> weights: array<f32>;
@group(0) @binding(4) var<storage, read> biases: array<f32>;
@group(0) @binding(5) var<storage, read_write> output_values: array<f32>;
@group(0) @binding(6) var<uniform> dims: BandDims;

fn source_value(global_y: u32, x: u32, channel: u32) -> f32 {
  if (global_y >= dims.current_start && global_y < dims.current_start + dims.current_h) {
    return current_values[((global_y - dims.current_start) * dims.input_w + x) * dims.input_c + channel];
  }
  if (global_y >= dims.previous_start && global_y < dims.previous_start + dims.previous_h) {
    return previous_values[((global_y - dims.previous_start) * dims.input_w + x) * dims.input_c + channel];
  }
  return next_values[((global_y - dims.next_start) * dims.input_w + x) * dims.input_c + channel];
}

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let output_w = select(dims.input_w, dims.input_w * 2u, dims.upsample != 0u);
  let x = id.x;
  let local_y = id.y;
  let output_channel = id.z;
  if (x >= output_w || local_y >= dims.output_h || output_channel >= dims.output_c) { return; }
  let global_output_y = dims.output_start + local_y;
  var sum = biases[output_channel];
  let expanded_h = select(dims.full_input_h, dims.full_input_h * 2u, dims.upsample != 0u);
  let expanded_w = select(dims.input_w, dims.input_w * 2u, dims.upsample != 0u);
  for (var ky = 0u; ky < dims.kernel; ky += 1u) {
    for (var kx = 0u; kx < dims.kernel; kx += 1u) {
      let expanded_y = i32(global_output_y) + i32(ky) - i32(dims.padding);
      let expanded_x = i32(x) + i32(kx) - i32(dims.padding);
      if (expanded_y < 0 || expanded_x < 0 || expanded_y >= i32(expanded_h) || expanded_x >= i32(expanded_w)) { continue; }
      let source_y = select(u32(expanded_y), u32(expanded_y) / 2u, dims.upsample != 0u);
      let source_x = select(u32(expanded_x), u32(expanded_x) / 2u, dims.upsample != 0u);
      for (var input_channel = 0u; input_channel < dims.input_c; input_channel += 1u) {
        let weight_index = (((output_channel * dims.input_c + input_channel) * dims.kernel + ky) * dims.kernel + kx);
        sum += source_value(source_y, source_x, input_channel) * weights[weight_index];
      }
    }
  }
  output_values[(local_y * output_w + x) * dims.output_c + output_channel] = sum;
}
`;

export const VAE_TILED_ADD_WGSL = /* wgsl */ `
struct AddDims { count: u32 }
@group(0) @binding(0) var<storage, read> left: array<f32>;
@group(0) @binding(1) var<storage, read> right: array<f32>;
@group(0) @binding(2) var<storage, read_write> output: array<f32>;
@group(0) @binding(3) var<uniform> dims: AddDims;
@compute @workgroup_size(256, 1, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  if (id.x < dims.count) { output[id.x] = left[id.x] + right[id.x]; }
}
`;
