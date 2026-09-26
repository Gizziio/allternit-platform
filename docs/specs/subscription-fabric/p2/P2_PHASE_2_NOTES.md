---
status: done
files_changed:
  - platform/packages/subscription-adapter-sdk/src/runtime.ts
  - platform/packages/subscription-adapter-sdk/src/download.ts
  - platform/packages/subscription-adapter-sdk/src/fixtures.ts
  - platform/packages/subscription-adapter-sdk/src/probe.ts
  - platform/packages/subscription-adapter-sdk/src/declarative.ts
  - platform/packages/subscription-adapter-sdk/src/conformance.ts
  - platform/packages/subscription-adapter-sdk/src/index.ts
  - platform/packages/subscription-adapter-sdk/test/fixture-web.ts
  - platform/packages/subscription-adapter-sdk/test/declarative.test.ts
  - platform/packages/subscription-adapter-sdk/test/conformance.test.ts
  - platform/packages/subscription-adapter-sdk/test/runtime.test.ts
  - platform/packages/subscription-adapter-sdk/test/probe.test.ts
  - platform/packages/subscription-adapter-sdk/test/download.test.ts
  - platform/packages/subscription-adapter-sdk/test/fixtures.test.ts
deviations:
  - "markSubmitted keeps the contracts single-arg signature; the SDK flips attempt.submission_state not_sent → sent_unconfirmed → acknowledged across calls and awaits the injected onMarkSubmitted durable write before returning (§A1 two-write rule; the worker owns persistence)."
  - "DeclarativeChatAdapter.probe(signal) has no page in the contract signature; the adapter binds the page from attach() via SdkAdapterRuntime (AdapterRuntime + page), and the conformance runner passes the same. Documented at the type."
  - "progress.heartbeat events are yielded from execute via a cast (as unknown as AdapterEvent) — the contracts AdapterEvent union has no heartbeat variant (carried from Phase 1; needs a contracts bump to type cleanly)."
  - "runConformance takes an optional injected Browser (opts.browser) — src cannot import the test-only launchBrowser system-Chrome fallback; its own default launch tries bundled chromium then channel chrome."
  - "probe() takes the SelectorPack explicitly alongside the manifest-like { auth, criticalKeys }; fixtureWebConfig declares criticalKeys [composer, send_button, logged_in_probe] because the Phase 1 pack also marks response/composer_textarea critical and the idle fixture legitimately has no response node. Per-adapter criticalKeys is the supported shape."
  - "captureDownload is implemented (Playwright download event → sink, magic-byte MIME verify) but has no live test — triggering a real download event needs a server/network. sniffMime is unit-tested for png/jpeg/webp/gif/pdf/zip."
remaining:
  - "Contracts bump: add { t: 'progress.heartbeat', elapsed_s, last_change_at } to the AdapterEvent union so the D11 heartbeat is typed end-to-end."
  - "Live captureDownload test once a download-triggering fixture exists (download attribute + data URL may work headless; deferred)."
  - "Gateway wiring (P3+): worker provides SdkAdapterRuntime/SdkPageLease, real ArtifactSink (content-addressed quarantine), and the durable onMarkSubmitted store write."
verify:
  - "pnpm -F @allternit/subscription-adapter-sdk build — PASS (tsc -b, clean)"
  - "pnpm -F @allternit/subscription-adapter-sdk test — PASS (14 files, 68/68 tests, ~13 s wall; Phase 1's 47 tests still green)"
  - "grep -riE 'chatgpt|claude|kimi|gemini|grok|deepseek|openai|anthropic' platform/packages/subscription-adapter-sdk — no matches"
  - "Conformance negative test: broken composer pack → ConformanceError naming 'composer' (test/conformance.test.ts)"
  - "Stall gate: static streaming fixture trips stalled; DOM-growing heartbeating fixture does not (test/declarative.test.ts)"
---

# P2 Phase 2 — subscription-adapter-sdk: runtime + declarative adapter + conformance

Phase 2 completes `@allternit/subscription-adapter-sdk` per
IMPLEMENTATION_PLAN.md lines 39–56 and the P2 verify/gate at lines 145–150.
Phase 1 files were built on as-is (no rewrites; no defects found).

## What landed

- **runtime.ts** (§A1) — `createExecutionContext` (markSubmitted two-write
  ordering with awaited durable write), `createPageLease` (SdkPageLease;
  throws on use-after-release), `createRedactingLogger` (messages + field
  values through the §A6.8 regex set — emails, bearer/API-shaped tokens,
  JWT-shaped strings, long digit runs — reimplemented locally, no dependency
  on the gateway package).
- **download.ts** (§A3.1 + §A6.5/§A6.6) — `captureDownload` (Playwright
  download event → sink stream), `captureImages` (img scan under a pack key;
  data: URLs decoded inline; network bodies fetched only from allowlisted
  origins; others skipped with reasons). Magic-byte MIME sniff for
  png/jpeg/webp/gif/pdf/zip; real sha256/size on every ArtifactFile; bytes
  land only via `ArtifactSink` begin→write→commit (fail on error).
- **fixtures.ts** (§A3.5) — `recordFixture` (strips input/textarea values,
  masks emails + long digit runs in text nodes, redact pass on the serialized
  HTML) and `loadFixture`. Tooling for future live captures; hand-written
  Phase 1 fixtures stay canonical.
- **probe.ts** (§A3.4) — auth-state check + every critical key + `capability:`
  entry-point locators (non-critical). Non-spending: no fills, no clicks.
  Vanished critical key → `ok: false` with failing checks listed.
- **declarative.ts** (§A3.3) — `DeclarativeChatAdapter` implements contracts
  `SubscriptionAdapter` from pure config `{ manifest, selectorsYaml,
  threadUrlPattern, banners, ... }`: attach/probe/execute/reconcile/readThread.
  `execute` yields challenge → `needs_user` (never retried, Critical #5),
  logged-out → `needs_user(auth)`, banner hits → `quota.signal` (deduped by
  kind), then `markSubmitted(sent_unconfirmed)` BEFORE the Send click and
  `acknowledged` after, `submitted`, then the D11 streaming loop (Phase 1
  step-list/counter/partial-artifact extractors + streaming-growth watcher +
  heartbeat with growing `elapsed_s`), completion via the Phase 1 tracker,
  `reply` events with the extracted markdown, `done`. Stall → `error` class
  `stalled` with `retryable` true ONLY when `submission_state = not_sent`
  (§A8); timeout likewise. No submit retries anywhere.
- **conformance.ts** (§A3.5) — `runConformance(factory, fixturesDir)` runs the
  six canonical fixture states: per-fixture selector resolution/absence,
  probe outcome, completion detection (completes vs CompletionTimeout),
  banner classification, plus pure thread-ID parsing. Structured
  `ConformanceReport`; non-empty failures throw `ConformanceError` carrying
  the report and naming every failing fixture/check.

## Tests (21 new, 68 total)

- `declarative.test.ts` — fixture-web end-to-end across idle / streaming /
  complete / limit-banner / challenge / logged-out: full event sequences,
  markSubmitted-before-Send ordering asserted against the fixture's DOM flag,
  quota.signal on banners, needs_user on challenge and logged-out, heartbeat
  growth, **stall gate** (static streaming fixture → `stalled`, retryable
  false once acknowledged; DOM-growing heartbeating fixture → no error,
  progress + heartbeat events), readThread fingerprint, reconcile
  not_found/ambiguous. Fake-clock injection keeps the stall tests ~1 s.
- `conformance.test.ts` — fixture-web passes the full suite; **negative gate**:
  deliberately-broken composer strategies → ConformanceError naming
  `composer`.
- `runtime.test.ts` — use-after-release lease throws; markSubmitted state
  machine + awaited durable write; redacting logger masks email/JWT/long-digit
  strings in messages and fields.
- `probe.test.ts` — idle ok, logged-out ok:false with `auth.state` +
  `logged_in_probe` failing, capability entry-point checks, adapter.probe via
  attach.
- `download.test.ts` — data-URL png/gif captured with correct sha256/mime,
  disallowed origin skipped, sink op ordering; sniffMime table test.
- `fixtures.test.ts` — recorder sanitization round-trip in a tmpdir.
