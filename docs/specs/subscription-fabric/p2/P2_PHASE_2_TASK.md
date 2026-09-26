# P2 Phase 2 Task — subscription-adapter-sdk: runtime + declarative adapter + conformance

You are building Phase 2 of 2 of `platform/packages/subscription-adapter-sdk/`. Phase 1 is complete and reviewed: scaffolding, `src/{selectors,completion,progress,composer,extract,banners,auth,pacing}.ts`, and the `test/fixtures/*.html` states exist with passing tests. **Build on them as-is; do not rewrite Phase 1 files.** Genuine defects: minimal fix + record under `deviations`.

## Normative sources (read first)

- `docs/specs/subscription-fabric/IMPLEMENTATION_PLAN.md` — SDK layout (lines 39–56), **P2 verify+gate (lines 145–150)** — your completion bar
- `docs/specs/subscription-fabric/REVIEW_CLAUDE.md` — §A1 (lines 361–417: ExecutionContext, markSubmitted two-write rule, no adapter retries), §A3/extensibility (lines 560–596: **DeclarativeChatAdapter shape, fixture recorder, conformance suite contents, hot-swap**), §A6.6 (downloads into content-addressed quarantine, MIME verify), §A8 (stall watchdog: retryable only if `not_sent`)
- `docs/specs/subscription-fabric/HARDENING.md` — D11 (progress/heartbeat), D12 is gateway-side (not yours)
- Contracts: `@allternit/subscription-fabric-contracts` — implement its `ExecutionContext`, `SubscriptionAdapter`, `PageLease`, `ArtifactSink`, `RedactingLogger`, `AdapterRuntime` interfaces; emit its `AdapterEvent` union; `ArtifactFile`/`ProviderArtifactRef` for captures.

## Exact deliverables

1. `src/runtime.ts` — the SDK-side implementations of the contracts boundary interfaces:
   - `createExecutionContext({ page, sink, pacer, resolver, logger, attempt, onMarkSubmitted })` → contracts `ExecutionContext`. **`markSubmitted(providerThreadId)` performs the durable write BEFORE returning** (§A1: `sent_unconfirmed` before Send, `acknowledged` after provider ack — two calls or a state arg; pick one shape, document it) via the injected `onMarkSubmitted` callback (the worker owns persistence; SDK just guarantees ordering).
   - `createPageLease(page)` → contracts `PageLease` (scoped; `release()` detaches; adapter must not retain — throw on use-after-release).
   - `createRedactingLogger(base)` → contracts `RedactingLogger` that passes every message/field through a redact function (reuse the gateway's redact *patterns* — reimplement the small regex set here, do NOT cross-depend on the service package).
2. `src/download.ts` — `captureDownload(page, sink, trigger)` (Playwright download event → stream into `ArtifactSink`), `captureImages(page, resolver, sink, opts)` (largest rendered image, or network response body for image URLs on allowed origins only — §A3.1 + §A6.5). Both verify MIME (magic-byte sniff for png/jpeg/webp/gif/pdf/zip at minimum) and produce `ArtifactFile` with real sha256/size. Quarantine semantics: files land only via the sink, never auto-opened (one comment line).
3. `src/fixtures.ts` — fixture **recorder/loader** (§A3.5): `recordFixture(page, name, outDir)` saving a sanitized DOM snapshot (strip inputs' values, mask emails/long digit runs via the redact regexes), `loadFixture(name)` for tests. The Phase 1 hand-written fixtures remain canonical; this is the tooling for future live captures.
4. `src/probe.ts` — `probe(page, resolver, manifest-like { auth, criticalKeys })` → contracts `ProbeResult`: auth state + every `critical: true` locator key + capability entry-point locators declared in the pack (§A3.4) — **non-spending, never submits**. A vanished critical key → `ok: false` with the failing checks listed.
5. `src/declarative.ts` — **`DeclarativeChatAdapter`** (§A3.3): implements contracts `SubscriptionAdapter` driven entirely by config: `{ manifest, selectorsYaml, threadUrlPattern, banners }` — `attach/probe/execute/reconcile/readThread` for chat-only providers with NO per-provider TS. `execute` yields the full AdapterEvent stream: `submitted` → `reply`/`progress`/`progress.heartbeat` (wire Phase 1 progress extractors + heartbeat) → `done`/`error`; maps banner hits to `quota.signal`; challenge interstitial → `needs_user`; uses `markSubmitted` ordering; completion via Phase 1 `awaitCompletion`; stall → `error` with `stalled` (retryable only when `not_sent`, §A8). No retry of submits, ever (§A1).
6. `src/conformance.ts` — the shared **conformance suite runner** (§A3.5): `runConformance(adapterFactory, fixturesDir)` executing the standard checks against fixture pages: selector resolution (all critical keys resolve on the right states), completion detection, banner classification, thread-ID parsing, probe on each state. Structured pass/fail report per check; **fails loudly** (non-empty failures → throw/reject with the list).
7. `test/` — vitest:
   - **fixture-web declarative adapter end-to-end** (the P2 verify): a fake declarative adapter (`fixtureWebConfig` in test/) driving `idle`/`streaming`/`complete`/`limit-banner`/`challenge` fixtures via `page.setContent` — assert the full event sequence per state, `markSubmitted` called before submit, `quota.signal` on banner, `needs_user` on challenge.
   - **Conformance negative test (P2 gate)**: `runConformance` against a deliberately-broken selector pack (rename one critical key's strategies so nothing matches) → fails loudly naming that key.
   - **Stall watchdog (P2 gate)**: static fixture with no DOM change beyond `stall_timeout_s` → `stalled`; a heartbeating fixture (streaming growth) does NOT trip it.
   - download/capture: `captureImages` on a fixture with embedded data-URL images (allowed origin) → `ArtifactFile` with correct sha256/mime; disallowed-origin URL skipped.
   - runtime: use-after-release PageLease throws; markSubmitted ordering asserted via a recording fake; redacting logger masks email/JWT-shaped strings in fields.
   - probe: `logged-out` fixture → `auth_required`-style failure checks; `idle` → ok.
8. `src/index.ts` — named re-exports grouped by module (contracts-package style).

## Hard gates (P2 gate from IMPLEMENTATION_PLAN lines 145–150)

- `pnpm -F @allternit/subscription-adapter-sdk build` and `test` PASS (Phase 1 tests must stay green).
- Conformance runner exists + fails loudly on a deliberately-broken selector (negative test present).
- Static-fixture stall trips `stalled`; heartbeating fixture does not.
- No provider-name literals anywhere in the package or test fixtures.
- No comments narrating code; one-line spec pointers only.

## Completion sentinel

Write `docs/specs/subscription-fabric/p2/P2_PHASE_2_NOTES.md` with YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`, `verify`) then prose. That file existing = done.
