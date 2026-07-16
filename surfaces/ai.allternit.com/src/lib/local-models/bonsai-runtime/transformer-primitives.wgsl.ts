export const TRANSFORMER_PRIMITIVES_WGSL = /* wgsl */ `
struct RawDimensions { a: u32, b: u32, c: u32, d: u32 }

@group(0) @binding(0) var<storage, read> input_values: array<f32>;
@group(0) @binding(1) var<storage, read> parameter_a: array<f32>;
@group(0) @binding(2) var<storage, read> parameter_b: array<f32>;
@group(0) @binding(3) var<storage, read_write> output_values: array<f32>;
@group(0) @binding(4) var<uniform> raw_dimensions: RawDimensions;

var<workgroup> partial_a: array<f32, 256>;
var<workgroup> partial_b: array<f32, 256>;

@compute @workgroup_size(256, 1, 1)
fn affine_layer_norm(
  @builtin(workgroup_id) group: vec3<u32>,
  @builtin(local_invocation_id) local: vec3<u32>,
) {
  let tokens = raw_dimensions.a;
  let width = raw_dimensions.b;
  let epsilon = bitcast<f32>(raw_dimensions.c);
  let token = group.x;
  let lane = local.x;
  if (token >= tokens) { return; }
  var sum = 0.0;
  var square_sum = 0.0;
  for (var column = lane; column < width; column += 256u) {
    let value = input_values[token * width + column];
    sum += value;
    square_sum += value * value;
  }
  partial_a[lane] = sum;
  partial_b[lane] = square_sum;
  workgroupBarrier();
  for (var stride = 128u; stride > 0u; stride >>= 1u) {
    if (lane < stride) {
      partial_a[lane] += partial_a[lane + stride];
      partial_b[lane] += partial_b[lane + stride];
    }
    workgroupBarrier();
  }
  let mean = partial_a[0] / f32(width);
  let variance = max(partial_b[0] / f32(width) - mean * mean, 0.0);
  let inverse_standard_deviation = inverseSqrt(variance + epsilon);
  for (var column = lane; column < width; column += 256u) {
    let normalized = (input_values[token * width + column] - mean) * inverse_standard_deviation;
    output_values[token * width + column] = normalized * (1.0 + parameter_a[column]) + parameter_b[column];
  }
}

@compute @workgroup_size(128, 1, 1)
fn rms_norm_rope(
  @builtin(workgroup_id) group: vec3<u32>,
  @builtin(local_invocation_id) local: vec3<u32>,
) {
  let sequence = raw_dimensions.a;
  let heads = raw_dimensions.b;
  let width = raw_dimensions.c;
  let epsilon = bitcast<f32>(raw_dimensions.d);
  let token = group.x;
  let head = group.y;
  let batch = group.z;
  let lane = local.x;
  if (token >= sequence || head >= heads || width != 128u) { return; }
  let base = ((batch * heads + head) * sequence + token) * width;
  let value = input_values[base + lane];
  partial_a[lane] = value * value;
  workgroupBarrier();
  for (var stride = 64u; stride > 0u; stride >>= 1u) {
    if (lane < stride) { partial_a[lane] += partial_a[lane + stride]; }
    workgroupBarrier();
  }
  let normalized = value * inverseSqrt(partial_a[0] / f32(width) + epsilon) * parameter_a[lane];
  let pair = lane / 2u;
  let pair_base = base + pair * 2u;
  partial_a[lane] = normalized;
  workgroupBarrier();
  let real = partial_a[pair * 2u];
  let imaginary = partial_a[pair * 2u + 1u];
  let cosine = parameter_b[(token * width / 2u) + pair];
  // Sine values immediately follow all cosine values.
  let sine = parameter_b[sequence * width / 2u + (token * width / 2u) + pair];
  output_values[base + lane] = select(
    imaginary * cosine + real * sine,
    real * cosine - imaginary * sine,
    lane % 2u == 0u,
  );
}

@compute @workgroup_size(256, 1, 1)
fn swiglu(@builtin(global_invocation_id) id: vec3<u32>) {
  let elements = raw_dimensions.a;
  let width = raw_dimensions.b;
  let index = id.x;
  if (index >= elements * width) { return; }
  let row = index / width;
  let column = index % width;
  let gate = input_values[row * width * 2u + column];
  let value = input_values[row * width * 2u + width + column];
  output_values[index] = gate / (1.0 + exp(-gate)) * value;
}

@compute @workgroup_size(256, 1, 1)
fn gated_residual(@builtin(global_invocation_id) id: vec3<u32>) {
  let elements = raw_dimensions.a;
  let width = raw_dimensions.b;
  let index = id.x;
  if (index >= elements * width) { return; }
  output_values[index] = input_values[index] + parameter_a[index] * parameter_b[index % width];
}

@compute @workgroup_size(256, 1, 1)
fn add_residual(@builtin(global_invocation_id) id: vec3<u32>) {
  let elements = raw_dimensions.a;
  let width = raw_dimensions.b;
  let index = id.x;
  if (index >= elements * width) { return; }
  output_values[index] = input_values[index] + parameter_a[index];
}
`;
