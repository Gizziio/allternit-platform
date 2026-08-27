---
status: done
files_changed:
  - surfaces/ai.allternit.com/src/lib/local-models/bonsai-runtime/bonsai-runtime.ts
  - surfaces/ai.allternit.com/src/lib/local-models/bonsai-runtime/qwen-tokenizer.ts
  - surfaces/ai.allternit.com/src/lib/local-models/bonsai-runtime/qwen-kernel-benchmark.ts
  - surfaces/ai.allternit.com/src/lib/local-models/bonsai-runtime/index.ts
  - sdk/allternit-sdk/src/ai-runtime/providers/mlx/index.ts
  - sdk/allternit-sdk/src/ai-runtime/providers/registry.ts
  - sdk/allternit-sdk/src/ai-runtime/providers/index.ts
blockers: []
---

# Qwen Local Model Runtime — Phase 1 Notes

## Summary

All five assigned items from Track Q have been addressed:

| ID  | Item                        | Prior   | Now  |
|-----|-----------------------------|---------|------|
| Q1  | Bonsai WebGPU Runtime       | PARTIAL | DONE |
| Q2  | Bonsai Tokenizer            | PARTIAL | DONE |
| Q3  | Bonsai Compute Kernels      | PARTIAL | DONE |
| Q4  | MLX Memory Provider         | DONE    | DONE |
| Q5  | Apple MLX Adapter           | MISSING | DONE |
| Q6  | Ollama Provider             | DONE    | DONE |

## What was implemented

### Q1 — Bonsai WebGPU Runtime facade
Created `bonsai-runtime.ts`, a public-facing `BonsaiRuntime` class that wraps the
existing owned-pipeline, text-encoder-runner, and tokenizer into a single entry point.
Exposes:
- `BonsaiRuntime.probeWebGpu()` — static check for WebGPU availability and adapter limits
- `initialize()` — requests a high-performance GPU device and constructs runners
- `encodePrompt()` — runs the Qwen text encoder and returns GPU embeddings
- `extractEmbeddings()` — reads prompt embeddings back to host memory as `Float32Array`
- `generateImage()` — full image generation pipeline (text encode → diffusion → VAE)
- `tokenize()` / `detokenize()` — BPE tokenization access
- `dispose()` — releases all GPU resources
- Status lifecycle: `idle → loading → ready → generating → error`

### Q2 — Tokenizer decode path
Added to `QwenBpeTokenizer`:
- `decode(ids)` — id-to-text round-trip using a reverse vocabulary and byte-to-unicode inversion
- `decodeStreaming(ids, previousLength)` — incremental decode for streaming generation
- `vocabularySize()` — reports total vocab size (regular + special tokens)
- Internal `specialById` map populated at construction time for O(1) special-token decode

### Q3 — Compute kernel diagnostics and benchmark
Created `qwen-kernel-benchmark.ts` with `QwenKernelBenchmark`:
- `benchmark(entryPoint, rows, width, iterations)` — measures GPU dispatch latency and
  computes GFLOPS for each kernel entry point (`rms_norm`, `rms_norm_rope`, `silu_multiply`,
  `concat_three`)
- `runDiagnostics()` — CPU-verified RMS normalization reference compared against GPU output
  with max-error reporting; returns pass/fail per test

### Q5 — Apple MLX adapter
Created `providers/mlx/index.ts` following the established Ollama adapter pattern:
- `AllternitMLX` class with configurable `baseURL` and `defaultModel`
- SSE-streaming `chat()` and `generate()` async generators
- `listModels()` and `isAvailable()` health check
- Full TypeScript types for requests, responses, and stream deltas
- Registered in `PROVIDER_REGISTRY` with metadata: `requiresApiKey: false`,
  `supportsStreaming: true`, default models include community Qwen/Llama/Mistral 4-bit packs

## What remains for Phase 2

1. **Autoregressive text generation loop** — The `BonsaiRuntime` currently exposes
   prompt encoding and image generation but does not yet run the full causal LLM
   decode loop (KV-cache, top-k/top-p sampling, stop-token detection). The Qwen
   layer executor and attention kernels are all present; Phase 2 wires them into
   a streaming `generateText()` method.
2. **Unit tests** — Tokenizer round-trip tests and kernel diagnostic tests.
3. **MLX adapter tool calling** — The MLX serving API supports tool-use schemas;
   the adapter should pass through `tools` in chat requests.
4. **MLX provider auto-discovery** — Probe common local ports (e.g. 8080) to
   detect a running MLX server without explicit config.
