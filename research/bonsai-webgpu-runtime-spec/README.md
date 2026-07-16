# Bonsai WebGPU runtime capture

This directory defines the engineering capture format used to replace the
downloaded `webml-community/bonsai-image-webgpu` runtime with an auditable
Allternit implementation.

The Phase A Worker records a bounded, prompt-free trace in memory. Call
`bonsaiWebGpuProvider.exportRuntimeSpec()` after a generation and save the
returned object here during an authorized browser validation run. Do not commit
the upstream minified JavaScript bundle or model weights.

## Capture schema

`version` is currently `1`. Event arrays are capped at 20,000 entries each.

- `shaders`: WGSL source and shader-module labels.
- `fetches`: URL, HTTP range, response status, content length, and content range.
- `pipelines`: compute pipeline creation order, labels, and entry points.
- `bindGroups`: bind-group creation order and binding indices. Buffer contents
  are deliberately excluded.
- `writes`: queue write offsets and sizes; buffer contents are excluded.
- `dispatches`: workgroup dimensions in execution order.

The capture does not record the image prompt, authentication headers, response
bodies, model weights, or GPU buffer contents. Review captures for signed URLs
or tokens before committing them.

## Pinned transformer facts

The revision-pinned safetensors header was inspected with HTTP range requests;
the model file itself was not downloaded into the repository.

- Revision: `2c24c81b934a658ba5590cf39088ba929985b4a8`
- Transformer SHA-256: `b21737bdf02690b7d662907781c4dc8b8bf22a2c98b823b1ca3336f48371a84f`
- Header length: 44,712 bytes
- Tensor count: 369 (`100 U32`, `269 BF16`)
- Packed weight shape: `[output_rows, input_columns / 16]`
- Scale/bias shape: `[output_rows, input_columns / 128]`
- Packing: sixteen 2-bit codes per little-endian `u32`
- Dequantization: `weight = code * scale + bias`
- Sampled publisher groups have `bias = -scale`, mapping codes `0, 1, 2`
  to `-scale, 0, +scale`; code `3` is unused for valid ternary packs.

Pinned manifest metadata accounts for 3,888,274,639 bytes total, below the
8 GB installation ceiling. The 4-bit Qwen3 text encoder is 2,263,022,529 bytes
(SHA-256 `e240c0bdc0ebb0681bf0da0f98d9719fd6ebe269a3633f81542c13e81345651d`)
with a 102,329-byte header, 36 layers, hidden width 2,560, MLP width 9,728,
32 query heads, eight KV heads, 4-bit groups of 64, and output layers
9/18/27. The VAE is 168,120,878 bytes (SHA-256
`ca70d2202afe6415bdbcb8793ba8cd99fd159cfe6192381504d6c4d3036e0f04`)
with a 28,120-byte header and channels `[128,256,512,512]`. Header probes
transferred only 136 KB into a trapped temporary directory, which was deleted.

## Owned transformer graph

The auditable implementation follows the installed Apache-2.0 MLX reference:

1. Dense-project 128-channel image tokens and 7,680-channel text embeddings to
   the shared 3,072-dimensional stream.
2. Run five double-stream blocks. Each applies SiLU-conditioned affine layer
   normalization, joint 24-head text/image attention with four-axis RoPE,
   gated residual attention, then separate gated SwiGLU feed-forwards.
3. Concatenate text before image tokens and run twenty single-stream blocks.
   Each block uses one packed projection for Q/K/V and the two SwiGLU halves,
   joint attention, a packed output projection, and a gated residual.
4. Drop text tokens, apply timestep-conditioned final affine layer norm, and
   dense-project back to 128 latent channels.

Constants: 24 heads × 128 dimensions, 9,216 MLP dimensions, layer/RMS norm
epsilon `1e-6`, RoPE theta `2000`, and RoPE axis dimensions `[32,32,32,32]`.
The exact publisher tensor mapping is executable data in
`bonsai-runtime/transformer-spec.ts`.

The owned online-softmax attention kernel was compiled by Chromium 150 with no
WGSL diagnostics and executed against a CPU oracle on 2026-07-15. Its two
checked output values agreed within `1.1e-7`. The kernel never allocates the
`query_length × key_length` score matrix; its working storage is one 128-value
reduction array plus one scalar accumulator per output lane.

The tensor-layout shader also compiles in Chromium WebGPU with no diagnostics.
It maps the fused single-stream projection into head-major Q/K/V plus row-major
MLP pairs and reverses the attention layout for the output projection.
`SingleBlockExecutor` records the complete no-readback single-stream command
graph: adaptive layer norm, packed ternary fused projection, Q/K RMSNorm and
RoPE, exact online attention, SwiGLU, packed output projection, and gated
residual. Its current auditable f32 reference path estimates activation memory
before allocating and needs about 1.56 GB at 4,096 tokens, excluding weights;
an f16/tiled optimization remains necessary for reliable 1024px generation.
The executor rejects a fused projection larger than the adapter's
`maxStorageBufferBindingSize` instead of triggering device loss.

The pinned MLX source fixes the conditioning contract: a timestep at or below
one is multiplied by 1,000, embedded as 128 cosine values followed by 128 sine
values with frequency base 10,000, then passed through dense-3072, SiLU, and a
second dense-3072 projection. Single-stream modulation applies SiLU and projects
to `[shift, scale, gate]`; adaptive layer norm uses
`normalized * (1 + scale) + shift`. Double-stream image and text modulation
each produce two consecutive triples for attention and feed-forward. The owned
conditioning code implements the timestep and single-stream paths with aligned
GPU buffer views rather than copying the three parameter slices.

`DoubleBlockExecutor` now records the five-block reference graph: separate
adaptive normalization and Q/K/V projections, stream-specific Q/K RMSNorm,
text-before-image joint attention, separate attention output projections, and
separate gated SwiGLU feed-forwards. The joint tensor-layout shader was
numerically exercised in Chromium with two text rows and one image row; the
row-major → head-major → concatenate → slice round trip returned all twelve
sentinel values in their exact original order. All temporary browser data was
removed after the probe.

The owned path now includes the full reference component graph: checksum-pinned
Qwen byte-level BPE tokenization, selective 4-bit embedding-row range loading,
27 Qwen layers sufficient to capture hidden states 9/18/27, five double-stream
and twenty single-stream diffusion blocks, the four-step flow schedule, and the
Flux2 VAE decoder through RGB PNG conversion. The 4-bit affine kernel compiled
and returned the numerical oracle value `64`; Qwen RMSNorm/rotate-half RoPE,
grouped-query causal attention, embedding, convolution, group-normalization,
unpatch, and 512-channel VAE attention shaders all compile in Chromium with no
diagnostics. The M1 adapter reports 256 MiB maximum buffers and 128 MiB storage
bindings. Embeddings therefore load only referenced vocabulary rows and double
modulation uses 8,192-row tiles. The transformer now bounds its oversized
single-stream fused projection and double-stream feed-forward pair with exact
row tiling (1,213 fused rows at a 128 MiB binding limit). High-resolution VAE
decode switches before the first oversized upsample to horizontal feature bands
of at most 64 MiB. GroupNorm uses per-band GPU reductions followed by global
statistics, 3x3 convolutions bind previous/current/next bands for exact halo
access, and bands are split again before upsampling when required. The owned
pipeline now accepts dimensions through 1024px, pending full numerical and
end-to-end validation of this tiled path.

On 2026-07-15 the four tiled VAE modules and the shared-memory packed-affine,
tensor-layout, and transformer-primitive modules compiled with zero diagnostics
in installed Chrome on the M1 adapter. Synthetic GPU oracles returned partial
statistics `[3,5]`, global normalization `[-1,1]`, a cross-band 3x3 halo result
of `[2,3]`, and residual addition `[11,22]`. The optimized 8x8x32 packed-affine
tile returned `[528,528,528,32,32,32]` for a 2-row/3-output boundary case.

## Storage safety

Phase A installation and generation measure origin-storage growth every 250 ms.
They abort at 6,000,000,000 bytes, preserving 2 GB of headroom below the user's
absolute 8 GB ceiling, and delete the partial `bonsai-image-v1` CacheStorage
bucket on failure. Manual browser validation must also record filesystem free
space before and after the run, close the browser context, and delete both the
model and runtime cache buckets before considering cleanup complete.

The worker permits only `GET`/`HEAD` for the exact checksum-pinned runtime URL
and an enumerated set of model/config/tokenizer files beneath the pinned model
revision. Arbitrary repository paths are rejected, preventing the third-party
bundle from using an attacker-chosen filename as a telemetry channel. The owned
runtime omits credentials/referrers and uses `cache: no-store` for weight ranges.

## Phase A verification ledger

- 2026-07-15, Chromium 150: dedicated Worker loaded the upstream artifact from
  an empty runtime cache, downloaded exactly 911,943 bytes, verified SHA-256
  `8e1726c485bfdae81ad7fa479a73a60cc27313a40e5b76b588245d1c9416f0eb`,
  stripped the DOM prelude/application tail at the pinned byte boundaries, and
  exposed `BonsaiImage` with no console errors.
- The earlier same-origin iframe implementation was rejected after Chromium
  reported that its sandbox flags permitted escape. It was removed and replaced
  by `public/bonsai-webgpu-worker.js`.
- 2026-07-16, Chromium 150, guarded harness: a full 512px generation was
  attempted from an empty runtime cache with two independent guards (worker
  origin-storage growth aborts at 6 GB; harness closes the browser if filesystem
  free space falls by 8 GB). The worker loaded the pinned bundle and began
  downloading model weights. Filesystem free space fell by 8 GB before the
  worker's origin-storage estimate reached its 6 GB limit, causing the harness
  to close the browser. The CacheStorage model bucket and the disposable browser
  profile were deleted; free space returned to baseline. This confirms the
  upstream runtime's network-to-CacheStorage path transiently exceeds the 8 GB
  disk ceiling on this machine, so a full Phase A 512px capture remains blocked
  unless weights are pre-seeded to avoid browser download-cache amplification.

## Automated harness

`phase-a-harness.mjs` launches a disposable local static server, opens installed
Chrome with a fresh profile, probes the pinned worker, installs the model, runs
a deterministic seed-42 512×512 generation, exports the capture, records PNG
SHA-256, and enforces the 8 GB filesystem free-space ceiling. It deletes the
browser profile on success and leaves it for resume on failure. The harness
confirmed on 2026-07-16 that the upstream runtime's network-to-CacheStorage path
exceeds the 8 GB ceiling before generation can start.

### Unblocking Phase A

The observed pressure comes from browser download-cache amplification on top of
the ~3.9 GiB model that ultimately lands in CacheStorage. Options to stay under
the ceiling are:

1. Pre-download the pinned model files with `curl`/`wget` (no browser cache
   amplification), then seed `bonsai-image-v1` CacheStorage from disk before the
   worker runs. The worker's fetches then hit cache and should avoid the extra
   transient write pressure.
2. Intercept the worker's `fetch` to serve the pre-downloaded files from the
   local static server, bypassing the network stack entirely. This requires a
   small harness-only change to the worker's fetch instrumentation.
3. Relax the filesystem ceiling for the upstream capture only, keeping the
   worker's 6 GB origin-storage guard as the primary limit.

## Validation sequence

1. Start the normal Allternit surface in an authorized development session.
2. Enable Fast WebGPU mode and accept the disclosure.
3. Generate the deterministic seed-42 red-cube prompt from the handoff.
4. Export the capture and redact any URL query strings containing credentials.
5. Record browser, GPU adapter, bundle hash, image dimensions, seed, and output
   PNG hash alongside the capture.
