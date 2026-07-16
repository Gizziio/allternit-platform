/**
 * Auditable reference kernel for MLX packed-affine 2-bit and 4-bit weights.
 *
 * Weight matrices are row-major [N, K]. Sixteen 2-bit values occupy each u32.
 * Every 128 weights along K share an affine scale and bias:
 *     dequantized = scale * quantized_code + bias
 * For symmetric ternary packs the publisher encodes bias = -scale, mapping
 * codes 0, 1, 2 to -scale, 0, +scale; code 3 is unused.
 *
 * The 8x8 output tile advances through K in 32-value chunks. Input values and
 * dequantized weights are loaded once into workgroup memory and reused by eight
 * dot products, preserving the transparent affine formula while avoiding the
 * reference kernel's redundant global reads and unpacking.
 */
export const PACKED_AFFINE_MATMUL_WGSL = /* wgsl */ `
struct Dimensions {
  m: u32,
  n: u32,
  k: u32,
  group_size: u32,
  bits: u32,
}

@group(0) @binding(0) var<storage, read> input: array<f32>;
@group(0) @binding(1) var<storage, read> packed_weights: array<u32>;
@group(0) @binding(2) var<storage, read> scales: array<f32>;
@group(0) @binding(3) var<storage, read> biases: array<f32>;
@group(0) @binding(4) var<storage, read_write> output: array<f32>;
@group(0) @binding(5) var<uniform> dims: Dimensions;

const OUTPUT_TILE: u32 = 8u;
const INNER_TILE: u32 = 32u;
var<workgroup> input_tile: array<f32, 256>;
var<workgroup> weight_tile: array<f32, 256>;

fn code_at(row: u32, column: u32) -> u32 {
  let codes_per_word = 32u / dims.bits;
  let packed_columns = (dims.k + codes_per_word - 1u) / codes_per_word;
  let word = packed_weights[row * packed_columns + column / codes_per_word];
  let mask = (1u << dims.bits) - 1u;
  return (word >> ((column % codes_per_word) * dims.bits)) & mask;
}

@compute @workgroup_size(8, 8, 1)
fn main(
  @builtin(workgroup_id) workgroup: vec3<u32>,
  @builtin(local_invocation_id) local: vec3<u32>,
) {
  let row = workgroup.y * OUTPUT_TILE + local.y;
  let column = workgroup.x * OUTPUT_TILE + local.x;
  let linear_lane = local.y * OUTPUT_TILE + local.x;
  let groups_per_row = (dims.k + dims.group_size - 1u) / dims.group_size;
  var sum = 0.0;
  for (var inner_base = 0u; inner_base < dims.k; inner_base += INNER_TILE) {
    for (var tile_index = linear_lane; tile_index < OUTPUT_TILE * INNER_TILE; tile_index += 64u) {
      let tile_row = tile_index / INNER_TILE;
      let inner_offset = tile_index % INNER_TILE;
      let inner = inner_base + inner_offset;
      let input_row = workgroup.y * OUTPUT_TILE + tile_row;
      input_tile[tile_index] = select(0.0, input[input_row * dims.k + inner], input_row < dims.m && inner < dims.k);
      let weight_row = workgroup.x * OUTPUT_TILE + tile_row;
      if (weight_row < dims.n && inner < dims.k) {
        let group = weight_row * groups_per_row + inner / dims.group_size;
        weight_tile[tile_index] = f32(code_at(weight_row, inner)) * scales[group] + biases[group];
      } else {
        weight_tile[tile_index] = 0.0;
      }
    }
    workgroupBarrier();
    for (var inner_offset = 0u; inner_offset < INNER_TILE; inner_offset += 1u) {
      sum += input_tile[local.y * INNER_TILE + inner_offset] *
        weight_tile[local.x * INNER_TILE + inner_offset];
    }
    workgroupBarrier();
  }
  if (row < dims.m && column < dims.n) { output[row * dims.n + column] = sum; }
}
`;
