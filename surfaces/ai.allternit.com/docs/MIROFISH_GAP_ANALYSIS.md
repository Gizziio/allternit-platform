# MiroFish — Gap Analysis (post-E2E-verification)

Date: 2026-07-17. Basis: full code read of `src/lib/mirofish/`, `src/lib/sandbox/swarm/`,
`src/plugins/built-in/mirofish/plugin.ts`, `MiroFishPanel.tsx`, plus the live E2E test run
(see `MIROFISH_TEST_RESULTS.md`). Every "observed" note below is from real runs, not theory.

**Overall verdict:** the implementation is clean and well-layered for a Phase-2 feature —
interfaces where they matter (`MemoryStore`, `SwarmProvider`), failure-tolerant fan-out,
deliberate scope restraint. The gaps are about what happens under real-world load, real
failure, and real users — not about the architecture being wrong.

---

## P0 — Robustness gaps (would bite real users quickly)

### 1. No cancellation, no timeouts, anywhere in the run path
`runSimulation`/`buildPersonas`/`askPersona` accept no `AbortSignal`, and no `generateText`
call sets `abortSignal` or a timeout. Consequences:
- Closing the panel / switching modes mid-run keeps all in-flight and queued model calls
  going — invisible token spend (a 12×3 default run is ~48 calls).
- There is no Cancel button, and no way to build one without plumbing.
- **Observed live:** a single wedged fetch (dead keep-alive socket) froze a run *forever* —
  the browser never rejects a stuck fetch on its own. The 60s-timeout fetch added during
  testing covers only the dev/local override path; the production gateway path has no such
  guard.

**Fix shape:** thread one `AbortSignal` from the panel through `RunSimulationOptions` into
every `generateText`; wrap all model calls (not just local dev) in timeout+retry; add a
Cancel button that aborts and keeps whatever personas/rounds already completed.

### 2. Persona generation output is unvalidated and unbounded
`parsePersona` regex-matches `{...}` and silently falls back on malformed JSON: bio becomes
the raw response text, traits become `{}`, name becomes `Persona local-xxx-1` (leaking
internal unit ids into the UI). No `maxOutputTokens`, no JSON response format, no retry on
unparseable output.
- **Observed live:** a persona whose `bio` was a literal raw JSON blob (`"{\n \"name\":
  \"Lucas\"...`) because the model's JSON was truncated/malformed — shipped to the persona
  card as-is.

**Fix shape:** set `maxOutputTokens`, request JSON output properly (tool call or
`Output.object` / json response format), one retry on parse failure, and a non-leaky
fallback name ("Persona 3 of 12").

### 3. Partial failure is invisible to the user
Failed persona generations and failed turns are console-`logger.warn` only. A run where 7 of
12 personas silently dropped, or a round where half the agents didn't act, renders as a
normal success. (Total persona failure now throws — fixed during testing — but partial
degradation is still silent.)

**Fix shape:** carry failure counts in `WorldState`/`RoundSummary` (`agentsActed`/`agentsTotal`)
and badge them in the UI ("Round 2 — 9/12 agents responded").

### 4. Concurrency defaults will hit real rate limits
The panel never passes `concurrency`, so round fan-out runs at `LocalSwarmProvider`'s
internal default of **20 concurrent calls** (scheduler's own default is 10 — the two defaults
disagree). Against a real cloud gateway, a 50-persona population fires 20 simultaneous
requests with the AI SDK's default 2 retries and no rate-limit-aware backoff.

**Fix shape:** one shared default (≤5 for cloud), surface it in `SimulationConfig`, and let
429s trigger exponential backoff rather than burning retries.

---

## P1 — Service-quality gaps (the feature works; these make it feel good)

### 5. Zero progress feedback during a multi-minute run
One monolithic `await` behind a "Running…" spinner. The default 12×3 run is ~48 sequential-ish
model calls — minutes of silence indistinguishable from a hang (we personally mistook wedged
runs for slow ones while testing, in both directions).

**Fix shape:** an `onProgress` callback in `RunSimulationOptions` (persona i/N, round r/R,
turn t/T) → progress bar + persona cards appearing live as they're built + round reports
streaming in as each round completes. Single biggest UX win available.

### 6. Everything is lost on refresh
`WorldState` lives in component state; the `MemoryStore` lives in a module-level Map keyed by
world id (which also grows unboundedly — a small leak per run). No history, no reload, no
sharing. The `MemoryStore` interface was explicitly designed for a future `DrizzleMemoryStore`.

**Fix shape:** persist world + memory (SQLite via the existing drizzle setup, or the 8013
API when server-side execution lands). **Must be user_id/project_id-scoped from day one** —
multi-tenant by default is an explicit repo rule. Evict `memoryStoresByWorldId` on overwrite.

### 7. Model selection ignores the user's choice
Everything routes through `getDefaultPluginModel()` (latest Anthropic from the registry),
while the composer right next to the panel shows a model picker the user already set. Cost
scales linearly with population×rounds, so model choice genuinely matters here.

**Fix shape:** accept a model id in `SimulationConfig` (default: current behavior), show the
active model + a registry-priced cost estimate next to the "N personas × R rounds" hint.

### 8. Round summaries display internal unit ids
`summarizeRound` prints `local-mrp5i332-1: …` instead of persona names. Trivial fix
(map `personaId` → persona name), large readability gain — this text is the centerpiece of
the round-by-round report.

### 9. Deep Interaction is single-turn and context-thin
Each "Ask" is independent: the prompt includes persona + seed + own memory, but not the
previous Q&A exchanges (the UI shows a chat history the model never sees) and not the other
agents' round summaries. Answers also arrive non-streamed.

**Fix shape:** include prior exchanges (it's already in `chatByPersonaId`) and the round
summaries in the ask prompt; stream the answer.

### 10. Full seed text is re-sent in every prompt
Persona and turn prompts embed the seed untruncated; only `askPersona` clamps it (1500
chars). A 20k-char seed × 12 personas × 3 rounds pays that token cost ~48 times.

**Fix shape:** clamp consistently (or summarize the seed once and reuse). While in there:
seed text is untrusted input interpolated straight into prompts — fine for a local tool,
but worth structural separation (system vs user content) before this is a hosted service.

---

## P2 — Platform/strategic gaps

### 11. Client-side execution is the ceiling
All simulation LLM calls run in the browser (repo-wide pattern, not MiroFish-specific).
That caps everything above: no server-side persistence, no resumable/background runs, no
"email me when my 50×10 simulation finishes", keys must reach the client, and dev needed the
Ollama override because the Vercel gateway is CORS-blocked from browsers. When any mode
graduates to "a service", routing model calls through the 8013 gateway is the unlock —
MiroFish (long-running, many-call) benefits most of all modes.

### 12. The E2B tier is built but completely unexercised
MiroFish deliberately uses `LocalSwarmProvider` (right call — nothing to isolate), and the
engine hardcodes it (`RunSimulationOptions` has `concurrency` but no `provider`). So
`e2b-provider.ts` has no live consumer and has never run against real E2B. Either give it a
consumer (code-executing swarm variants — the natural Phase-4 feature), inject the provider
via options so it's at least testable, or explicitly park it before it rots.

### 13. Test coverage doesn't cover the failure modes that actually happened
9 unit tests pass, but none cover: total-persona-failure throw (added during testing),
`parsePersona` on malformed/truncated JSON (observed live), or `askPersona` at all. The
failure modes we hit in production-like conditions are exactly the untested paths.

### Adjacent debt (not MiroFish, hit while testing)
`app-models.ts` still hardcodes `kimi/kimi-for-coding` for ~10 default-model constants and
lists it 3× in `ANONYMOUS_AVAILABLE_MODELS` — violates the registry-derived-model-ids rule.

---

## Suggested sequencing

| Order | Item | Size |
|---|---|---|
| 1 | Quick wins: #8 names in summaries, #2 persona JSON hardening, #4 unify concurrency default, #13 tests for the observed failure modes | S |
| 2 | #1 abort/timeout/cancel plumbing (one signal, all call sites, Cancel button) | M |
| 3 | #5 onProgress + streaming results into the UI | M |
| 4 | #7 model selection + cost estimate; #9 deep-interaction context + streaming; #10 seed clamp | M |
| 5 | #6 persistence (tenant-scoped) — pairs naturally with #11 server-side execution when that lands | L |
