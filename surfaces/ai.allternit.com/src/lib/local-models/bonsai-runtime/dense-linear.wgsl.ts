export const DENSE_LINEAR_WGSL = /* wgsl */ `
struct Dimensions { rows: u32, output_width: u32, input_width: u32, activate_input: u32 }

@group(0) @binding(0) var<storage, read> input_values: array<f32>;
@group(0) @binding(1) var<storage, read> weights: array<f32>;
@group(0) @binding(2) var<storage, read_write> output_values: array<f32>;
@group(0) @binding(3) var<uniform> dimensions: Dimensions;

@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
  let column = id.x;
  let row = id.y;
  if (row >= dimensions.rows || column >= dimensions.output_width) { return; }
  var sum = 0.0;
  for (var inner = 0u; inner < dimensions.input_width; inner += 1u) {
    var value = input_values[row * dimensions.input_width + inner];
    if (dimensions.activate_input != 0u) { value = value / (1.0 + exp(-value)); }
    sum += value * weights[column * dimensions.input_width + inner];
  }
  output_values[row * dimensions.output_width + column] = sum;
}
`;

