# Local-First Model Implementation Plan

Last updated: 2026-07-15

## Verified implementation status

The Ollama runtime path and the native Bonsai companion path are integrated. The Gemma browser entry and the Bonsai WebGPU (browser) entries are architecture/catalog records and are not installable yet. They must not be represented as production-ready until the runtime delivery tasks below are completed and verified.

Verified on 2026-07-15: the production web bundle succeeds; focused runtime/mode tests pass (32, including loopback enforcement); Ollama ran `llama3.2:3b` and produced identical schema-valid output in two fixed-seed inference runs. That test model was removed afterwards to reclaim disk space and is not currently installed on this machine (the pre-existing `qwen2.5:0.5b` remains). Full-project type checking remains blocked by pre-existing errors in `use-mini-app-catalog.ts` and `BrowserExtensionsView.tsx`, outside this local-model change set. The prescribed Playwright CLI package resolver also hung, so a cross-browser visual release pass is still open.

Also verified on 2026-07-15: the native Bonsai companion generated deterministic, byte-identical seed-42 PNGs through the official PyPI `mlx==0.31.1` wheel (no Xcode required — the pinned MLX fork differs from upstream by one 1-bit-only guard). Companion weights were deleted afterwards to respect this machine's disk budget; `services/bonsai-local/install.sh` restores them. The desktop app now supervises the companion (install with streamed progress, cancellation, repair/update, start/stop with app lifecycle, removal), the Local Model Manager exposes that lifecycle with an explicit Apache-2.0 acceptance checkbox, and the Ollama provider refuses non-loopback endpoints unless explicitly opted in.

## Completed foundation

- [x] Define the versioned `allternit.model.v1` manifest.
- [x] Define a provider-neutral local runtime contract.
- [x] Add a duplicate-safe local provider registry.
- [x] Add capability-based model routing.
- [x] Add catalog entries for the default Ollama brain, Gemma 4 E2B, and both Bonsai Image 4B variants.
- [x] Implement Ollama health, discovery, inspection, pull progress, removal, streaming generation, load, unload, and cancellation.
- [x] Add a trusted browser WebGPU adapter boundary that refuses unknown executable runtimes.
- [x] Surface the replaceable local-model catalog in Local Brain settings with explicit delivery status.
- [x] Document privacy boundaries, security controls, installation, storage, and zero recurring inference-cost distribution.
- [x] Add focused registry, routing, and manifest tests.
- [x] Package the pinned native Bonsai companion (`services/bonsai-local`, loopback-only, CORS-restricted).
- [x] Verify native Bonsai generation end-to-end with deterministic seed-42 PNGs (PyPI `mlx==0.31.1` wheel).
- [x] Supervise the companion from the desktop app: install, progress, cancellation, repair/update, start/stop with app lifecycle, removal.
- [x] Expose the companion lifecycle in the Local Model Manager with explicit license acceptance and installed-revision display.
- [x] Enforce loopback-only local runtime endpoints with explicit remote opt-in.

## Runtime delivery

- [ ] Vendor or implement the reviewed Bonsai Image WebGPU runtime under its license.
- [ ] Register `bonsai-image-webgpu` with `BrowserWebGpuProvider`.
- [ ] Add browser Cache Storage or OPFS persistence, checksums, resumable progress, repair, and removal.
- [ ] Add WebGPU adapter-limit and memory preflight checks before download.
- [ ] Add explicit model-license acceptance and required notices.
- [ ] Implement the Gemma 4 WebGPU adapter or use a verified compatible Transformers.js release.
- [ ] Keep video on the local desktop runtime until a verified WebGPU video engine is practical.

## Capability verification

- [ ] Persist provider/model/version capability results.
- [ ] Test streaming, structured output, tools, vision, embeddings, and seed behavior locally.
- [ ] Mark catalog claims separately from verified runtime capabilities.
- [ ] Disable capabilities that fail conformance tests.

## Product integration

- [ ] Add install, pause, resume, repair, update, and remove actions to the catalog cards.
- [ ] Add model-role assignment for primary brain, router, reasoning, vision, embeddings, images, and video.
- [ ] Route Agent modes by required capability rather than provider or model name.
- [ ] Display a network disclosure before enabling search, connectors, hosted telemetry, or cloud fallback.
- [ ] Add local-only and allow-network session policies.

## Release verification

- [x] Build the production web bundle.
- [x] Run real Ollama inference with a downloaded local model.
- [x] Verify fixed-seed repeatability on the current Ollama/model/runtime combination.
- [ ] Test Chrome, Edge, Safari, and Firefox WebGPU capability detection.
- [ ] Test model-cache eviction and recovery.
- [ ] Test Ollama loopback access and origin restrictions on web and desktop surfaces.
- [ ] Test cancellation releases GPU memory.
- [ ] Test prompts never leave the device in local-only mode.
- [ ] Test unsupported devices receive an accurate explanation and safe fallback choices.

The foundation is implemented, not the browser inference products. A catalog entry does not mean its inference kernel is bundled. Installation must remain disabled until a trusted runtime adapter is licensed, registered, and verified.
