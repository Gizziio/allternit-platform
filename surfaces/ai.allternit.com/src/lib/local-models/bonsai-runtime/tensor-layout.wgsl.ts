export const TENSOR_LAYOUT_WGSL = /* wgsl */ `
struct Dimensions { rows: u32, width: u32, heads: u32, mlp_width: u32 }

@group(0) @binding(0) var<storage, read> source: array<f32>;
@group(0) @binding(1) var<storage, read> secondary: array<f32>;
@group(0) @binding(2) var<storage, read_write> destination: array<f32>;
@group(0) @binding(3) var<uniform> dimensions: Dimensions;

// Projection rows are [Q | K | V | MLP gate | MLP value]. Q/K/V are converted
// from row-major hidden layout to [head, token, head_dimension] for attention.
@compute @workgroup_size(256, 1, 1)
fn split_qkv_mlp(@builtin(global_invocation_id) id: vec3<u32>) {
  let head_width = dimensions.width / dimensions.heads;
  let projected_width = dimensions.width * 3u + dimensions.mlp_width * 2u;
  let total = dimensions.rows * projected_width;
  let index = id.x;
  if (index >= total) { return; }
  let row = index / projected_width;
  let column = index % projected_width;
  if (column < dimensions.width * 3u) {
    let component = column / dimensions.width;
    let hidden = column % dimensions.width;
    let head = hidden / head_width;
    let lane = hidden % head_width;
    let component_size = dimensions.rows * dimensions.width;
    let destination_index = component * component_size + (head * dimensions.rows + row) * head_width + lane;
    destination[destination_index] = source[index];
  } else {
    let destination_index = dimensions.rows * dimensions.width * 3u + row * dimensions.mlp_width * 2u +
      (column - dimensions.width * 3u);
    destination[destination_index] = source[index];
  }
}

// Converts attention output [head, token, head_dimension] back to row-major
// hidden layout and appends the row-major activated MLP values.
@compute @workgroup_size(256, 1, 1)
fn concat_attention_mlp(@builtin(global_invocation_id) id: vec3<u32>) {
  let output_width = dimensions.width + dimensions.mlp_width;
  let total = dimensions.rows * output_width;
  let index = id.x;
  if (index >= total) { return; }
  let row = index / output_width;
  let column = index % output_width;
  if (column < dimensions.width) {
    let head_width = dimensions.width / dimensions.heads;
    let head = column / head_width;
    let lane = column % head_width;
    destination[index] = source[(head * dimensions.rows + row) * head_width + lane];
  } else {
    destination[index] = secondary[row * dimensions.mlp_width + column - dimensions.width];
  }
}

@compute @workgroup_size(256, 1, 1)
fn rows_to_heads(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  let total = dimensions.rows * dimensions.width;
  if (index >= total) { return; }
  let row = index / dimensions.width;
  let hidden = index % dimensions.width;
  let head_width = dimensions.width / dimensions.heads;
  let head = hidden / head_width;
  let lane = hidden % head_width;
  destination[(head * dimensions.rows + row) * head_width + lane] = source[index];
}

// dimensions.rows=text rows and dimensions.mlp_width=image rows.
@compute @workgroup_size(256, 1, 1)
fn concat_head_sequences(@builtin(global_invocation_id) id: vec3<u32>) {
  let text_rows = dimensions.rows;
  let image_rows = dimensions.mlp_width;
  let combined_rows = text_rows + image_rows;
  let total = combined_rows * dimensions.width;
  let index = id.x;
  if (index >= total) { return; }
  let head_width = dimensions.width / dimensions.heads;
  let head_elements = combined_rows * head_width;
  let head = index / head_elements;
  let within_head = index % head_elements;
  let row = within_head / head_width;
  let lane = within_head % head_width;
  if (row < text_rows) {
    destination[index] = source[(head * text_rows + row) * head_width + lane];
  } else {
    destination[index] = secondary[(head * image_rows + row - text_rows) * head_width + lane];
  }
}

// Extracts a row-major slice from a joint head-major tensor. mlp_width is the
// source row offset; destination length determines the number of output rows.
@compute @workgroup_size(256, 1, 1)
fn heads_to_rows_slice(@builtin(global_invocation_id) id: vec3<u32>) {
  let index = id.x;
  let total = arrayLength(&destination);
  if (index >= total) { return; }
  let row = index / dimensions.width;
  let hidden = index % dimensions.width;
  let head_width = dimensions.width / dimensions.heads;
  let head = hidden / head_width;
  let lane = hidden % head_width;
  destination[index] = source[(head * dimensions.rows + row + dimensions.mlp_width) * head_width + lane];
}
`;
