export const DENSE_LINEAR_WGSL = /* wgsl */ `
struct Dimensions { rows: u32, output_width: u32, input_width: u32, activate_input: u32 }

@group(0) @binding(0) var<storage, read> input_values: array<f32>;
@group(0) @binding(1) var<storage, read> weights: array<f32>;
@group(0) @binding(2) var<storage, read_write> output_values: array<f32>;
@group(0) @binding(3) var<uniform> dimensions: Dimensions;

const TILE: u32 = 8u;
const INNER_TILE: u32 = 32u;
var<workgroup> input_tile: array<f32, 256>;
var<workgroup> weight_tile: array<f32, 256>;

@compute @workgroup_size(8, 8, 1)
fn main(
  @builtin(workgroup_id) workgroup: vec3<u32>,
  @builtin(local_invocation_id) local: vec3<u32>,
) {
  let row = workgroup.y * TILE + local.y;
  let column = workgroup.x * TILE + local.x;
  let linear_lane = local.y * TILE + local.x;
  var sum = 0.0;
  for (var inner_base = 0u; inner_base < dimensions.input_width; inner_base += INNER_TILE) {
    for (var tile_index = linear_lane; tile_index < TILE * INNER_TILE; tile_index += 64u) {
      let tile_row = tile_index / INNER_TILE;
      let inner_offset = tile_index % INNER_TILE;
      let inner = inner_base + inner_offset;
      let input_row = workgroup.y * TILE + tile_row;
      var value = select(0.0, input_values[input_row * dimensions.input_width + inner], input_row < dimensions.rows && inner < dimensions.input_width);
      if (dimensions.activate_input != 0u && input_row < dimensions.rows && inner < dimensions.input_width) {
        value = value / (1.0 + exp(-value));
      }
      input_tile[tile_index] = value;
      let weight_row = workgroup.x * TILE + tile_row;
      if (weight_row < dimensions.output_width && inner < dimensions.input_width) {
        weight_tile[tile_index] = weights[weight_row * dimensions.input_width + inner];
      } else {
        weight_tile[tile_index] = 0.0;
      }
    }
    workgroupBarrier();
    for (var inner_offset = 0u; inner_offset < INNER_TILE; inner_offset += 1u) {
      sum += input_tile[local.y * INNER_TILE + inner_offset] * weight_tile[local.x * INNER_TILE + inner_offset];
    }
    workgroupBarrier();
  }
  if (row < dimensions.rows && column < dimensions.output_width) {
    output_values[row * dimensions.output_width + column] = sum;
  }
}
`;

