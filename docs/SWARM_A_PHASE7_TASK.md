# Swarm A — Phase 7 Task

**Worktree:** `/Users/joe/Desktop/allternit-parity-p2-swarm-a`  
**Branch:** `ao/p7-a`  
**Base:** `parity/swarm-sprint`

## Goal
Add Google Vertex AI as a provider and expand model registry coverage.

## Deliverables

1. **Vertex AI provider**
   - Add `vertex` provider support to `sdk/allternit-sdk/src/ai-runtime/harness/` config and request transforms.
   - In `provider-request.ts`, add `toVertexRequest` that maps the normalized harness contract to Vertex AI's request format (Google Gemini API over Vertex).
   - Support `reasoning`/`thinking`, `responseFormat`, and `tools` mapping.
   - Add tests in `provider-request.test.ts`.

2. **Model registry expansion**
   - Add Vertex AI model entries to `model-registry.ts` (e.g. `gemini-1.5-pro`, `gemini-1.5-flash`) with `contextWindow` and `maxOutputTokens`.
   - Add model deprecation/replacement metadata support to the registry: optional `deprecated?: boolean` and `replacement?: string`.
   - Add a test.

## Validation
- `cargo check -p allternit-api` — pass
- `bun test sdk/allternit-sdk/src/ai-runtime/harness/__tests__` — pass

## Commit
Commit on `ao/p7-a` with message: `feat(p7): Swarm A Vertex AI provider and model registry expansion`.
