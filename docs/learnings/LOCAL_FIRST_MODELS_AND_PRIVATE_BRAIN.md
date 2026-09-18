# Local-First Models and the Allternit Private Brain

## What local-first means

Allternit can run compatible AI models on the user's own device instead of sending every prompt to a hosted inference API. The application supplies a trusted runtime, model installer, capability checks, and permission controls. Model weights can be downloaded directly from their publisher or imported from files the user already owns.

Local-first does not mean that a model uses no storage or memory. A browser model is downloaded into browser-managed storage and copied into GPU memory while it runs. An Ollama or llama.cpp model is stored by that local runtime. After installation, compatible models can work without an internet connection.

## Privacy and security promises

When a model is marked **Local**:

- inference runs on the user's device;
- prompts and generated output are not sent to an Allternit inference service;
- Allternit does not need an API key or a per-generation payment;
- tools remain behind Allternit's permission layer; and
- removing a model deletes the copy managed by that runtime or browser profile.

Allternit must not describe a workflow as fully local when it uses remote search, a cloud connector, a hosted model, remote telemetry containing prompt content, or another network tool. The interface must identify those actions before they occur.

Local models are not automatically trusted agents. A model may request a tool, but it cannot directly read files, browse authenticated sites, run commands, or modify a workspace. Allternit validates the request and applies the same approval and permission rules regardless of which model produced it.

## Zero recurring inference-cost distribution

Allternit packages the model-management pattern, not every multi-gigabyte weight file. This avoids operating an Allternit model CDN or GPU service:

1. Allternit ships the trusted WebGPU and native-provider adapters.
2. The catalog contains small declarative manifests.
3. The user chooses a model and accepts its download size and license.
4. Weights download directly from the official publisher, or the user imports local files.
5. Allternit verifies declared hashes when the publisher supplies them.
6. The runtime caches the model locally and reports installation progress.
7. Generation runs on the user's hardware.

This design has no per-generation API expense for Allternit. Publishers can change availability or hosting policies, and users still pay for their own electricity, device storage, and network connection.

## One catalog, multiple runtimes

The catalog describes capabilities and compatible runtimes rather than hard-coding one provider:

```text
Allternit Local Model Catalog
  ├── Browser WebGPU
  ├── Ollama
  ├── llama.cpp
  ├── Transformers.js / ONNX Runtime Web
  └── future trusted runtime adapters
```

A model entry may provide more than one installation choice. For example, a small language model could run directly through WebGPU or through Ollama. Agent modes request capabilities such as `tools`, `vision`, or `structured-output`; they do not need to know which runtime supplies them.

## Model manifest

All catalog entries use the versioned `allternit.model.v1` manifest:

```json
{
  "schema": "allternit.model.v1",
  "id": "gemma-4-e2b-local",
  "name": "Gemma 4 E2B",
  "kind": "brain",
  "tasks": ["chat", "vision", "tools"],
  "runtimes": [
    {
      "engine": "webgpu",
      "source": {
        "type": "huggingface",
        "repository": "publisher/model"
      }
    },
    {
      "engine": "ollama",
      "model": "publisher-model:tag"
    }
  ],
  "requirements": {
    "webgpu": true,
    "estimatedDownloadBytes": 1500000000,
    "minimumMemoryBytes": 4000000000
  }
}
```

Manifests are data, not executable extensions. Community manifests cannot introduce arbitrary JavaScript. New architectures require a reviewed Allternit runtime adapter.

## Provider standard

All local providers implement a shared contract for:

- connection and health checks;
- installed-model discovery;
- model inspection and capability reporting;
- installation, cancellation, and removal;
- chat or Responses-style streaming;
- embeddings where supported; and
- explicit load and unload operations where supported.

OpenAI-compatible request shapes are the inference baseline. Provider-specific endpoints are used only for lifecycle operations that the common protocol does not define. Ollama, for example, uses its native model discovery and pull endpoints while chat is exposed through its OpenAI-compatible interface.

## Capability verification

Catalog claims are hints. Installed capabilities should be confirmed through metadata and small local conformance checks:

- successful streaming;
- schema-constrained JSON;
- tool-call formatting;
- vision input;
- embedding dimensions;
- seeded repeatability on the same runtime; and
- practical context and memory limits.

Allternit stores the results per model version and runtime. The router selects only models whose verified capabilities satisfy the task. A failed check disables that capability; it does not grant the model broader access.

## Browser model lifecycle

1. Feature-detect WebGPU and required limits.
2. Show model source, license, size, and expected memory.
3. Ask the user before downloading.
4. Stream model files with progress and cancellation.
5. Cache them in browser-managed storage and request persistent storage when available.
6. Load inference in a Web Worker so the interface remains responsive.
7. Release temporary GPU buffers after generation.
8. Provide repair, update, and remove controls.

Browser storage can be cleared or evicted by the browser. Allternit must treat cached models as reinstallable assets rather than the only copy of user work.

## Ollama lifecycle

Allternit connects to Ollama on the loopback interface, normally `http://127.0.0.1:11434`. It discovers installed models, inspects metadata, streams pulls, and sends inference requests through the local service. Users should not expose an unauthenticated Ollama instance to a public network.

If a browser origin cannot reach the local endpoint because of origin or browser private-network protections, the Allternit desktop companion can provide a loopback bridge with an explicit origin allowlist. The bridge must never accept arbitrary remote origins.

## Model roles

Users can assign different local models to different roles:

- primary conversation brain;
- fast router;
- deep reasoning;
- vision;
- embeddings;
- image generation; and
- video generation.

This prevents one model from being treated as universally capable and lets users replace individual components as better open models appear.

## Initial model direction

- **Images:** Bonsai Image 4B is a target. Its public WebGPU Space currently distributes a minified build without a declared source license, so Allternit does not package or claim that runtime as integrated.
- **Local brain:** Ollama is the currently integrated runtime. Browser WebGPU language models use the same provider contract only after a reviewed adapter is registered.
- **Video:** a native local companion until a verified, practical WebGPU video runtime is available.

The architecture is the product: models are replaceable packages, runtimes are replaceable adapters, and permissions remain controlled by Allternit.

## Verified release state (2026-07-15)

The following statements are backed by tests on the current Apple Silicon development machine:

- Ollama `0.17.7` is reachable only through the configured loopback endpoint.
- `llama3.2:3b` was downloaded, checksum-verified by Ollama, installed as a 2.0 GB local model, and used for real inference. It was later removed to reclaim disk space and is not currently installed; the pre-existing `qwen2.5:0.5b` model remains.
- Two runs with temperature `0` and seed `4242` returned the same schema-valid JSON and identical token counts.
- The local provider registry, Ollama lifecycle/stream normalization, and retained Agent-mode selector pass 10 focused automated tests.
- The web application production bundle completes successfully.

These checks do **not** make the browser Bonsai or local video runtimes complete. The public Bonsai WebGPU Space contains an opaque minified bundle with no declared source license. Allternit will not redistribute it or describe it as secure, packaged, or production-ready without licensed auditable source. The official PrismML native Bonsai repository is Apache-2.0.

Native Bonsai image inference **has** passed an end-to-end test on this machine (2026-07-15): the companion served the pinned 2-bit ternary model through the official PyPI `mlx==0.31.1` wheel — no Xcode or Metal Toolchain required, because upstream's MLX git fork differs from upstream only by a 1-bit fast-path guard the 2-bit model never exercises. Two seed-42 runs produced byte-identical, valid PNGs and `/backends` returned `healthy: true`. The model weights were deleted afterwards to respect the disk-space budget on this machine; `./install.sh` in `services/bonsai-local` restores them.
