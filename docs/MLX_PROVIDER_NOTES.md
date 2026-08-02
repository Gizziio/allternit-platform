---
title: MLX provider switch in the memory agent
task: docs/MLX_PROVIDER_TASK.md
spec: .steering/spec.md (R1-R4)
status: done
date: 2026-08-02
files:
  - services/memory/agent/src/models/local-model.ts
  - services/memory/agent/src/models/local-model.test.ts
---

# MLX provider notes

## What changed

`services/memory/agent/src/models/local-model.ts` only (+ its new test).

- `LocalModelManager` constructor gains an optional third argument
  `llm?: LLMProviderConfig` (`{ baseUrl?, model? }`). Unset fields fall back
  to `MEMORY_LLM_BASE_URL` / `MEMORY_LLM_MODEL` env vars; model defaults to
  `qwen3-4b-instruct`. Existing callers (`orchestrator.ts` constructs
  `new LocalModelManager(host, port)`; agents receive the instance) are
  untouched and behave exactly as before when the env is unset (R2, R4).
- New private `openAIChat(messages, modelConfig)` posts to
  `{base}/chat/completions` (trailing slashes stripped from the base) via
  plain `fetch` — no new dependencies. Body: OpenAI shape with `model` from
  config/env, `messages` (system + user), and `temperature` / `top_p` /
  `max_tokens` taken from the task preset (MODEL_PRESETS values unchanged).
- `generate()` and `generateStream()` branch to `openAIChat` when a base URL
  is configured. `generateStream` (no callers today) yields the full
  non-streamed response as a single chunk on the MLX path; interface
  preserved.
- R3: non-2xx throws `OpenAI-compatible provider error at <endpoint>: HTTP
  <status>`; network failure throws `... unreachable at <endpoint>: <cause>`.
  There is no fallback to Ollama mid-config.

## Embeddings stay on Ollama

Embeddings live in `src/store/vector-store.ts`, which owns a separate Ollama
client hardcoded to `http://localhost:11434`. This change does not touch it,
so embeddings are Ollama-only by construction; the test suite asserts the
configured MLX endpoint receives zero requests during `embed()`.

## Verification

- `vitest run src/models/local-model.test.ts` — 6/6 pass:
  MLX path request shape (URL, model, messages, preset sampling params),
  default model `qwen3-4b-instruct`, env-unset Ollama path with preset model
  names, non-2xx error with endpoint + status, unreachable-endpoint error
  with no Ollama fallback, embeddings-stay-Ollama.
- Targeted `tsc --noEmit --strict` on the changed files: clean.

## Deviations / notes

- **Boot check documented, not run.** A full `http-server` boot requires
  `better-sqlite3`, whose native build fails on this machine's Node v26 —
  unrelated to this change and pre-existing. Boot-time wiring is instead
  covered by: (a) the constructor's env resolution being exercised in every
  MLX-path test, and (b) the unchanged constructor signature for existing
  callers. To verify live: `MEMORY_LLM_BASE_URL=http://localhost:8080/v1
  pnpm start:http` on a machine where the service's native deps install.
- **Test deps**: repo had no installed `node_modules`; `ollama`, `vitest@1`,
  `typescript`, `@types/node` were installed with `--no-save
  --no-package-lock` into the workspace root `node_modules` (npm walked up
  because the agent dir's `package.json` was temporarily moved aside to skip
  the `better-sqlite3` native build). No manifest or lockfile was modified.
