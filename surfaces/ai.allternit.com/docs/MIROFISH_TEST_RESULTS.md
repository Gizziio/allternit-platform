---
status: done
outcome: success
credential_status: no cloud credential needed — dev model access wired to local Ollama (see below)
files_changed:
  - src/lib/ai/app-models.ts (removed next/cache unstable_cache — threw in the Vite SPA and broke model resolution for every mode; plain module memo now; dead fetchChatModels/buildChatModels/PROVIDER_ORDER deleted)
  - src/lib/ai/providers.ts (dev-only local-model override in getLanguageModel via VITE_LOCAL_AI_BASE_URL; per-request 60s timeout fetch so a wedged socket aborts and the AI SDK retries)
  - src/lib/mirofish/persona-builder.ts (all-persona-failure now throws instead of silently returning [] — total failure surfaces in the panel's red error box)
  - vite.config.ts (/local-ai dev proxy to Ollama — kept as fallback; current config connects direct)
  - .env.local (VITE_LOCAL_AI_BASE_URL=http://127.0.0.1:11434/v1, VITE_LOCAL_AI_MODEL=qwen2.5:0.5b)
  - docs/MIROFISH_TESTING_HANDOFF.md (click-path corrections folded in)
tested_by: Claude Code (this session), playwright + installed Chrome, headless
tested_at: 2026-07-17 (final pass; supersedes the unstable_cache-blocked and CORS-blocked reports)
app_url: http://127.0.0.1:3013/ (pre-existing dev server)
---

# MiroFish — Live Browser Test Results: END-TO-END PASS

## TL;DR

The full feature works, verified live through the real UI with real model calls
(local Ollama `qwen2.5:0.5b`): **5 personas generated → 2 simulation rounds →
round-by-round report → Deep Interaction answered in character.** 16/16 model calls
succeeded, ~55s total. This is the handoff doc's "actual proof the whole feature
works end to end."

- Example persona: *Jane Lee — "a 35-year-old marketing executive who lost her job
  just months after she started working for the city council…"*
- Round 1 summary: "5 agents acted…" (each turn in-character on the congestion-charge seed).
- Deep Interaction: asked Jane Lee "Do you support this policy? Why or why not?" →
  coherent in-character pro-policy answer.

## What had to be fixed to get here (three real bugs + dev model access)

1. **`src/lib/ai/app-models.ts` imported `unstable_cache` from `next/cache`** — threw
   `Invariant: incrementalCache missing` on every model resolution in this Vite SPA,
   breaking every built-in mode. Now a plain module-level memo; dead
   `fetchChatModels`/`buildChatModels`/`PROVIDER_ORDER` removed.
2. **Silent ghost-run on total persona failure** (`src/lib/mirofish/persona-builder.ts`) —
   if every persona generation failed, `buildPersonas` returned `[]` and the run
   "completed" with nothing rendered and no error. Now throws with the first underlying
   error; partial failures still tolerated. Verified live via the red error box.
3. **Model access in dev** — the browser called `ai-gateway.vercel.sh` directly:
   CORS-blocked, and no `AI_GATEWAY_API_KEY` exists locally. Every mode was equally
   dead in dev. Fix: `getLanguageModel` now honors `VITE_LOCAL_AI_BASE_URL` (dev-only
   escape hatch) and routes every language-model call to local Ollama. Production
   (no env var) is untouched. A hardened local fetch adds a 60s per-request timeout
   because reused keep-alive sockets to Ollama were observed silently dying, wedging
   a run forever (a stuck browser fetch never rejects on its own).

## Test-harness lesson (cost several false "hang" verdicts)

Polling the page every 2s with an in-page `waitForFunction` reading
`document.body.innerText` (forces full layout, contends with React's commit phase
under concurrent-fetch load) reproducibly stalled runs mid-flight — logs and network
events stopped at the exact moment a batch of fetches dispatched. The identical app
flow with cheap Node-side polling completes reliably. If you automate against this
app: poll with targeted `querySelector` evaluations, never whole-body `innerText`.

## Verified working (all live, through the real UI click path)

- "Population Simulation" sub-tab next to "Specialist Team" under Agent Swarm ✔
- Panel renders fully; Run disables inputs, shows Running state ✔
- Persona generation: 5/5 real LLM calls, cards with name/bio/trait tags ✔
- Rounds: 2/2, five turns each, shared round-summary visible to next round ✔
- Round-by-round report timeline renders ✔
- Deep Interaction ("Ask {name}"): in-character answer rendered in chat ✔
- Error path (pre-fix run): total persona failure → exact cause in red error box ✔
- Unit tests: 9/9 mirofish suite passing ✔

## Environment notes for whoever runs this next

- Ollama must be running with the model pulled: `ollama pull qwen2.5:0.5b` (any
  chat model works — set `VITE_LOCAL_AI_MODEL`). Remove the two `VITE_LOCAL_AI_*`
  lines from `.env.local` to restore the production gateway path.
- A tiny 0.5B model produces goofy personas (bios drift, traits get creative) —
  fine for wiring proof; swap a bigger local model for content-quality testing.
- Unrelated pre-existing noise: recurring `501 (Not Implemented)` from the 8013
  gateway's agent-registry endpoint on page load.

## Evidence

`/tmp/mirofish-test/`: `result.json` (final success run incl. full fetch/engine
trace), `05-results.png` + `06-deep-interaction.png` (persona grid, rounds, chat),
`run.mjs` (repeatable driver), `diag.mjs`/`freeze-diag.mjs` (engine-direct and
freeze-isolation diagnostics).
