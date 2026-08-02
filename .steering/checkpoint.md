# Steering checkpoint

## Goal

Implement the memory agent bulk / fast ingest mode (spec:
`.pipeline/builds/memory-bulk-fast-ingest-TASK.md`, source spec
`.pipeline/queue/memory-bulk-fast-ingest.md`): when `POST /api/ingest` carries
`metadata.mode: "bulk"`, skip LLM enrichment, store the memory with raw content,
and keep it searchable; normal ingest pipeline remains unchanged; metadata
(source, trust_tier, provenance_ref) is preserved.

## Just did

- Implemented bulk mode in `services/memory/agent/src/ingest-agent.ts`:
  detects `metadata.mode === "bulk"`, sets summary to the first 500 characters
  of content, entities/topics to empty arrays, importance to `"medium"`, and
  bypasses `summarize`/`extractEntities`/`assessImportance`.
- Threaded `metadata` through the ingest path:
  - `http-server.ts` `/api/ingest` and `/api/ingest/bulk` forward metadata.
  - `orchestrator.ingest()` accepts optional `metadata` and passes it to the
    ingest agent.
- Extended `IngestResult` with `memory?: Memory` so `http-server.ts` can add
  successfully ingested memories to the in-memory vector index (fixes the
  pre-existing condition where `/api/vector/search` had no indexed memories).
- Added `services/memory/agent/src/ingest-agent.test.ts` covering R1–R5 with
  a mocked `LocalModelManager` and real `MemoryStore`.
- Fixed pre-existing `local-model.test.ts` embedding assertion that broke
  because a real Ollama server is running; the test now stubs `VectorStore.embed`
  and still verifies embeddings do not hit the MLX endpoint.
- Rebuilt `better-sqlite3` native bindings for Node v24 and ran verification
  with Node v24 (`/opt/homebrew/opt/node@24/bin`); default shell Node v26 cannot
  load or compile the binding.
- Wrote `docs/BUILD_MEMORY_BULK_FAST_INGEST_NOTES.md` and touched the sentinel.

## Next

Prescribed commit:
`git add -A && git commit -m "build(memory-bulk-fast-ingest): bulk/fast ingest mode for memory agent"`.
Fix and retry if the gate blocks.

## Open questions

- (none)
