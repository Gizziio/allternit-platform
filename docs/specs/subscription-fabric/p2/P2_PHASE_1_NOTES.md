---
status: done
files_changed:
  - platform/packages/subscription-adapter-sdk/package.json
  - platform/packages/subscription-adapter-sdk/tsconfig.json
  - platform/packages/subscription-adapter-sdk/vitest.config.ts
  - platform/packages/subscription-adapter-sdk/src/selectors.ts
  - platform/packages/subscription-adapter-sdk/src/completion.ts
  - platform/packages/subscription-adapter-sdk/src/progress.ts
  - platform/packages/subscription-adapter-sdk/src/composer.ts
  - platform/packages/subscription-adapter-sdk/src/extract.ts
  - platform/packages/subscription-adapter-sdk/src/banners.ts
  - platform/packages/subscription-adapter-sdk/src/auth.ts
  - platform/packages/subscription-adapter-sdk/src/pacing.ts
  - platform/packages/subscription-adapter-sdk/src/index.ts
  - platform/packages/subscription-adapter-sdk/test/helpers.ts
  - platform/packages/subscription-adapter-sdk/test/selectors.test.ts
  - platform/packages/subscription-adapter-sdk/test/completion.test.ts
  - platform/packages/subscription-adapter-sdk/test/progress.test.ts
  - platform/packages/subscription-adapter-sdk/test/composer.test.ts
  - platform/packages/subscription-adapter-sdk/test/extract.test.ts
  - platform/packages/subscription-adapter-sdk/test/banners.test.ts
  - platform/packages/subscription-adapter-sdk/test/auth.test.ts
  - platform/packages/subscription-adapter-sdk/test/pacing.test.ts
  - platform/packages/subscription-adapter-sdk/test/fixtures/selectors.v1.yaml
  - platform/packages/subscription-adapter-sdk/test/fixtures/logged-out.html
  - platform/packages/subscription-adapter-sdk/test/fixtures/idle.html
  - platform/packages/subscription-adapter-sdk/test/fixtures/streaming.html
  - platform/packages/subscription-adapter-sdk/test/fixtures/complete.html
  - platform/packages/subscription-adapter-sdk/test/fixtures/limit-banner.html
  - platform/packages/subscription-adapter-sdk/test/fixtures/challenge.html
  - platform/packages/subscription-adapter-sdk/test/fixtures/research-mid-run.html
  - platform/packages/subscription-adapter-sdk/test/fixtures/slides-mid-run.html
  - platform/packages/subscription-adapter-sdk/test/fixtures/static.html
deviations:
  - "test/helpers.ts launchBrowser() falls back to system Chrome (channel: 'chrome') when the bundled playwright chromium binary is absent — the CDN download stalled repeatedly on this machine (two `playwright install chromium` runs killed mid-extract). Fallback implemented by the orchestrator. Contracts §A5 real-Chrome/headful rules govern provider sessions, not these synthetic fixtures, so this is test-infra only."
  - "tsconfig.json adds \"lib\": [\"ES2020\", \"DOM\"] on top of the contracts mirror — page.evaluate callbacks in extract.ts/composer.ts need DOM types."
  - "extractPartialArtifacts takes opts.provider typed as contracts' branded ProviderId (tests cast 'fixture-web' as ProviderId)."
  - "vitest.config.ts sets hookTimeout 30 s — 8 parallel test files each launching a system-Chrome instance exceeded vitest's default 10 s hook timeout in full-suite runs (files passed individually). Added by the orchestrating session while re-verifying the gates."
remaining:
  - "Phase 2 files: runtime.ts, download.ts, probe.ts, fixtures.ts, declarative.ts, conformance.ts."
  - "P2 plan-level gate items that belong to Phase 2: conformance runner + negative test (deliberately-broken selector fails loudly); DeclarativeChatAdapter end-to-end against fixture pages."
  - "Bundled playwright chromium still not installed on this machine (~/Library/Caches/ms-playwright/chromium-1208 deleted after corrupt partial extract); tests currently run on system Chrome via the launchBrowser fallback. Re-run `pnpm -F @allternit/subscription-adapter-sdk exec playwright install chromium` on a healthier network."
verify:
  - "pnpm -F @allternit/subscription-adapter-sdk build — PASS (tsc -b, clean)"
  - "pnpm -F @allternit/subscription-adapter-sdk test — PASS (8 files, 47/47 tests)"
  - "grep -riE 'chatgpt|claude|kimi|gemini|grok|deepseek|openai|anthropic' platform/packages/subscription-adapter-sdk — no matches (exit 1)"
---

# P2 Phase 1 — subscription-adapter-sdk: scaffolding + DOM primitives + fixtures

Phase 1 of `@allternit/subscription-adapter-sdk` is complete: the shared DOM
primitives that shrink Subscription Fabric adapters to declarative config plus
hooks (IMPLEMENTATION_PLAN.md lines 39–56; REVIEW_CLAUDE.md §A3; HARDENING.md
D11). Phase 2 files were not started.

## What landed

- **selectors.ts** (§A3.2) — `SelectorPack.fromYaml` (js-yaml; named keys →
  `{ critical, strategies }`, file order honored) and `createResolver`, which
  satisfies the contracts `SelectorResolver` and adds `resolveLocator` /
  `tryResolveLocator` (Playwright `Locator`). Strategies walk in order with
  immediate presence checks (`locator.first().count()` — no hanging waits on
  static fixtures); unmatched keys throw `SelectorNotFoundError` naming the
  key. Drift telemetry: `lastMatchedStrategy(key)` returns `"index:kind"`, and
  `onDrift({ key, strategy_index, total })` fires whenever a key resolves past
  strategy 0. YAML `/re/i` strings become RegExp matchers for role/text.
- **completion.ts** (§A1) — `awaitCompletion` / `createCompletionTracker`:
  completes only when the stop button is absent, send is re-enabled, the
  response text has been stable for `stabilityMs` (default 2000), and no
  `streaming` locator resolves (absent pack key = no streaming node).
  Poll-based with injectable `now`/`sleep`; throws `CompletionTimeout` after
  `timeoutMs`. The tracker exposes `lastChangeAt()` and `stalled(stallTimeoutS)`
  as the D11 watchdog input.
- **progress.ts** (D11) — generic extractors driven by the `progress:` key
  group: `extractStepList` (per-step `progress` events, fraction = done/total
  from `data-state`), `extractCounterBadge` ("N/M" → fraction; "N sources" →
  label only), `watchStreamingGrowth` (response-text length deltas),
  `extractPartialArtifacts` (`artifact.partial` refs from present thumbnails),
  and `createHeartbeat` (`progress.heartbeat` with growing `elapsed_s` +
  `last_change_at`, default 15 s). The heartbeat shape is a local exported type
  (`ProgressHeartbeat`) because the contracts `AdapterEvent` union has no
  heartbeat variant (confirmed in `events.ts`).
- **composer.ts** (§A3.1) — `fillComposer` detects textarea/input vs
  contenteditable; textarea uses `fill`, contenteditable uses
  `pressSequentially` for short text and `keyboard.insertText` for >500 chars
  (never per-key typing for long prompts). `submit` clicks the send button,
  with an opt-in `{ fallback: "enter" }` escape when send is missing/disabled.
- **extract.ts** (§A3.1) — `extractLastAssistantTurn`: DOM → markdown with
  fenced code blocks (language from `language-*` class), citation links
  preserved as markdown links, headings/lists/blockquotes/inline formatting.
- **banners.ts** (§A3.1) — `createBannerClassifier`: first-match regex pack →
  `{ kind, raw_excerpt }` with the excerpt pre-truncated to 500 chars.
- **auth.ts** (§A3.1) — `detectAuthState` (logged-out URL pattern short-circuit,
  then `logged_in_probe` locator, then optional logged-in URL pattern) and
  `threadIdFromUrl` (first capture group).
- **pacing.ts** (§A5) — `createPacer` implements the contracts `Pacer`:
  `beforeAction` sleeps an rng-driven gap inside `min_action_gap_ms`;
  `beforeTask` enforces `min_task_gap_s` (sleeps the remainder), rolling
  hourly/daily caps (throws `PacingCapExceeded` with the cap name and
  `retryAfterS`), and `quiet_hours` windows that may wrap midnight. Fully
  injectable `now`/`rng`/`sleep` — pacing tests are pure unit tests.

## Fixtures + tests

Hand-written HTML fixtures for the generic `fixture-web` provider (all
`data-testid="fw-*"` hooks): logged-out, idle (contenteditable AND textarea
composer variants), streaming, complete (code block + citation link),
limit-banner (both variants in one file), challenge, research-mid-run
(3-of-5 step list + "12 sources" badge), slides-mid-run (2-of-5 thumbnails +
"2/5 slides" badge), static. The test-local pack `selectors.v1.yaml`
deliberately puts an absent first strategy on `send_button` so the drift path
is exercised against real fixtures.

47 tests across 8 vitest files cover the deliverable-12 matrix: fallback order
+ drift at strategy 1+, completion on `complete` / timeout on `streaming` /
per-signal breakdown / absent-streaming-key handling, all four progress
extractors + heartbeat growth (fake clock and real-interval), banner
classification (incl. 500-char truncation and first-match precedence), auth
ready vs auth_required (+ challenge interstitial + URL short-circuit),
threadIdFromUrl, composer fill on both composer kinds incl. the >500-char
paths, submit click + Enter fallback + no-fallback error, markdown fidelity,
pacing caps/gaps/quiet-hours with a fake clock, and stall detection on the
static fixture.
