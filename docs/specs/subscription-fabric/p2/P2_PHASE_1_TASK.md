# P2 Phase 1 Task — subscription-adapter-sdk: scaffolding + DOM primitives + fixtures

You are building Phase 1 of 2 of `platform/packages/subscription-adapter-sdk/` (`@allternit/subscription-adapter-sdk`) — the shared primitives that let Subscription Fabric adapters shrink to declarative config plus a few hooks. **Do NOT start Phase 2 files** (runtime.ts, download.ts, probe.ts, fixtures.ts, declarative.ts, conformance.ts) — phase 2 does those.

## Normative sources (read first)

- `docs/specs/subscription-fabric/IMPLEMENTATION_PLAN.md` — SDK file layout (lines 39–56) and **P2 verify+gate (lines 145–150)**
- `docs/specs/subscription-fabric/REVIEW_CLAUDE.md` — **§A3/extensibility design (lines 560–596: fillComposer, awaitCompletion multi-signal detector, extractLastAssistantTurn, detectBanners, detectAuthState, threadIdFromUrl, selector registry YAML shape + drift telemetry)**, §A1 lines 412–417 (completion signals + markSubmitted rules), §A5 line 466–472 (PacingProfile, worker-enforced)
- `docs/specs/subscription-fabric/HARDENING.md` — **D11 (lines 88–94: generic progress extractors — step lists, counter badges, streaming-text growth — driven by a `progress:` selector group; 15 s `progress.heartbeat` with growing `elapsed_s`; stall watchdog consumes `last_change_at`)**
- Contracts (merged): `@allternit/subscription-fabric-contracts` — your modules implement its boundary interfaces (`SelectorResolver`, `Pacer`, `RedactingLogger`, `PageLease`, `ArtifactSink`) and emit its `AdapterEvent`/`QuotaSignal` types. Import, don't redeclare.

## Repo conventions

- Package idiom: mirror `platform/packages/subscription-fabric-contracts` (ESM, tsc -b project references, vitest).
- Browser: `playwright` via `@allternit/browser-tools` (`workspace:*`) — §A3. For DOM unit tests, launch **headless chromium** once per test file and `page.setContent(fixtureHtml)` — no server, no network. The real-Chrome/headful rules (§A5) govern provider sessions, not synthetic fixtures. If the playwright chromium binary is missing, `pnpm exec playwright install chromium` is allowed.
- No git operations. You MAY run `pnpm install` (root, pnpm only), build, and test.

## Exact deliverables

1. `platform/packages/subscription-adapter-sdk/package.json` — name `@allternit/subscription-adapter-sdk`, `0.1.0`, ESM. Deps: `playwright` ^1.58.2, `@allternit/browser-tools` workspace:*, `@allternit/subscription-fabric-contracts` workspace:*, `zod` ^3.25.0. Dev: typescript, vitest, @types/node, js-yaml + @types/js-yaml (selector packs are YAML). Scripts: build (tsc -b), typecheck, test (vitest run).
2. `tsconfig.json` — mirror the contracts package (project references to both deps).
3. `src/selectors.ts` — the **selector registry** (§A3.2): load a YAML pack (`adapters/<p>/selectors/<version>.yaml` shape: named keys, `critical: boolean`, ordered `strategies` — `{ role, name? }` / `{ testid }` / `{ css }` / `{ text }`; semantic first, css last by convention but honor file order). `SelectorPack.fromYaml(text)`; `createResolver(page, pack)` returning the contracts `SelectorResolver` + `resolveLocator(key)` Playwright Locator, walking strategies in order; **drift telemetry**: record which strategy index matched per key (`lastMatchedStrategy`), emit an early-drift signal when a key resolves past strategy 0 (callback hook `onDrift({ key, strategy_index, total })`).
4. `src/completion.ts` — `awaitCompletion(page, resolver, opts)` implementing the §A1 **multi-signal detector**: stop button gone + send button re-enabled + response text unchanged for a stability window (default 2 s, configurable 1.5–3 s) + no in-flight streaming node (a `streaming` locator from the pack, absent = complete). Returns `{ completed: true, last_change_at }` or throws `CompletionTimeout`. Poll-based (MutationObserver optional); **drives the D11 stall watchdog**: expose `lastChangeAt()` and a `stalled(stallTimeoutS)` check.
5. `src/progress.ts` — **D11 generic progress extractors**, driven by a `progress:` key group in the selector pack: `extractStepList(page, resolver)` (enumerated step items → `{ t: "progress", label }` events), `extractCounterBadge` ("N sources" style → label + fraction when parsable), `watchStreamingGrowth` (response-text length deltas → progress events), `extractPartialArtifacts` (e.g. slide thumbnails appearing → `artifact.partial` refs via callback). Plus `createHeartbeat(emit, intervalMs=15000)` emitting `{ t: "progress.heartbeat", elapsed_s, last_change_at }` — test that it fires with growing `elapsed_s` on a static fixture.
6. `src/composer.ts` — `fillComposer(page, resolver, text)`: handles contenteditable and textarea; long prompts (>500 chars) via `insertText`/clipboard, never per-key typing (§A3.1); `submit(page, resolver)` clicks the send button or falls back to Enter per pack config.
7. `src/extract.ts` — `extractLastAssistantTurn(page, resolver)`: DOM → markdown, preserving code blocks (pre/code → fenced) and citation links (§A3.1).
8. `src/banners.ts` — regex packs → `QuotaSignal` classification (§A3.1 `detectBanners`): `createBannerClassifier(pack: Array<{ kind: QuotaSignal["kind"], pattern: RegExp }>)`, `classify(text)` → `{ kind, raw_excerpt } | null` with excerpt pre-truncated to 500.
9. `src/auth.ts` — `detectAuthState(page, resolver)` (URL pattern + logged-in probe locator → `ready | auth_required`), `threadIdFromUrl(url, pattern)` (§A3.1).
10. `src/pacing.ts` — the contracts `Pacer` impl (§A5): `createPacer(profile: PacingProfile, opts { now?, rng? })` — `beforeAction()` sleeps a random gap in `min_action_gap_ms`, `beforeTask()` enforces `min_task_gap_s` + hourly/daily caps (throws `PacingCapExceeded` when over `max_tasks_per_hour`/`max_tasks_per_day`; quiet_hours window blocks). Injectable clock/rng — pure unit tests, no real sleeps.
11. `test/fixtures/` — **hand-written** HTML for the generic `fixture-web` fake provider (NO real provider names/markup): `logged-out.html`, `idle.html` (composer + send, logged in), `streaming.html` (stop button visible, streaming node, partial response), `complete.html` (send re-enabled, full response with code block + citation link), `limit-banner.html` ("approaching limit" + "limit reached" variants), `challenge.html` (verification interstitial), `research-mid-run.html` (step list with 3 of N steps + "12 sources" counter badge), `slides-mid-run.html` (2 of 5 slide thumbnails present), `static.html` (for heartbeat/stall tests).
12. `test/` — vitest for every module above against the fixtures via `page.setContent`: selector fallback order + drift callback firing on strategy 1+, completion detector true on `complete` / false-or-timeout on `streaming`, progress extractors producing the right `progress`/`artifact.partial` events from the mid-run fixtures, heartbeat growing `elapsed_s` on `static`, banner classification on `limit-banner`, auth detect on `logged-out` vs `idle`, threadIdFromUrl patterns, composer fill on both contenteditable + textarea fixtures (add both to `idle.html`), extract markdown fidelity on `complete`, pacing caps with the fake clock.

## Hard gates

- No provider-name literals (`chatgpt|claude|kimi|gemini|grok|deepseek|openai|anthropic`) anywhere in the package or fixtures — it's `fixture-web` throughout.
- `pnpm -F @allternit/subscription-adapter-sdk build` and `test` PASS before you finish.
- No comments narrating code; one-line spec pointers only.

## Completion sentinel

Write `docs/specs/subscription-fabric/p2/P2_PHASE_1_NOTES.md` with YAML frontmatter (`status`, `files_changed`, `deviations`, `remaining`, `verify`) then prose. That file existing = done.
