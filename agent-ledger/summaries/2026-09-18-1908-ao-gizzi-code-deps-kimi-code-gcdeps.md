# 2026-09-18 1908 ao/gizzi-code-deps — undeclared runtime deps: ink stack, misc utils, telemetry

Agent: kimi-code (subagent lane of the repo-wide undeclared-deps sweep)
Branch: ao/gizzi-code-deps → PR #623, merged 087395a28 (merge commit; burn b0012 PR #622 merged ahead of it, clean rebase-free merge).

## What was done

Declared the remaining mechanical groups of undeclared runtime dependencies in cmd/gizzi-code/package.json, three commits, every import site verified against current main (161c8816a) before declaring. Sibling lanes had already landed: ssh-bridge (#614), landmines fuse.js/cli-highlight/redis/optionalDeps/cowsay/langchain (#620), platform/sdk (#621).

### Commit 5229ca860 — vendored ink stack (10 deps)
src/cli/ui/ink-app/ink/* is a vendored copy of ink 6.8.0 whose imports resolved only via pnpm's hoisted .pnpm/node_modules. Verified each import statically: auto-bind (ink.tsx), @alcalzone/ansi-tokenize (sliceAnsi/textHighlighting/output/log-update/screen), bidi-js (bidi.ts), cli-boxes (render-border.ts), code-excerpt + stack-utils (ErrorOverview.tsx), emoji-regex + get-east-asian-width (stringWidth.ts), indent-string (render-node-to-output.ts), wrap-ansi (wrapAnsi.ts). Versions = the set ink 6.8.0 upstream depends on, exact-pinned to existing lockfile resolutions (@alcalzone/ansi-tokenize 0.2.5, auto-bind 5.0.1, bidi-js 1.0.3, cli-boxes 3.0.0, code-excerpt 4.0.0, emoji-regex 10.6.0, get-east-asian-width 1.6.0, indent-string 4.0.0, stack-utils 2.0.6, wrap-ansi 10.0.0).

### Commit fdef0d9b1 — misc runtime utils (13) + relay servers (5)
Utils: ajv 8.20.0 — SyntheticOutputTool uses new Ajv({allErrors:true})+compile, version-agnostic across ajv 6/8, so aligned UP to the dominant lockfile resolution (8.20.0, 35 refs) instead of the sweep-flagged legacy 6.14.0; cacache 15.3.0 (dynamic import, npm-cache GC in cleanup.ts); env-paths 3.0.0 (cachePaths x2); https-proxy-agent 7.0.6 (proxy.ts x2 + telemetry); p-map 4.0.0 (mcp client x2); picocolors 1.1.1; picomatch 4.0.4 (dominant, 6 refs; gizzimd x2); plist 3.1.1 (notifier dynamic import); proper-lockfile 4.1.2; semver 7.8.5 (4 import sites); shell-quote 1.8.3; tree-kill 1.2.2; undici 7.28.0 (mtls/proxy use EnvHttpProxyAgent — requires >=7; 7.28.0 already in lock via @electron/get).
Relay servers: packages/cloud-relay and packages/cowork-controller are plain subdirs with NO package.json — their imports resolve against the gizzi-code manifest (same pattern as landmines PR's redis declaration). Declared ws 8.19.0 (dominant lock resolution, 21 refs; WebSocketServer/handleUpgrade/WebSocket.OPEN API verified against the 8.x surface), express 5.2.1 (vanilla json()/routes/listen — matches both 4 and 5; dominant 5.2.1), cors 2.8.6, uuid 10.0.0, jsonwebtoken 9.0.3.

### Commit 5c0b5ac09 — OpenTelemetry SDK + exporters (12)
utils/telemetry/instrumentation.ts statically imports @opentelemetry/sdk-metrics (MeterProvider/PeriodicExportingMetricReader/ConsoleMetricExporter) and @opentelemetry/sdk-trace-base (BasicTracerProvider/BatchSpanProcessor/ConsoleSpanExporter), and dynamically imports 10 OTLP/prometheus exporters inside per-protocol switch branches (grpc/http-json/http-proto for metrics, logs, traces + prometheus). All pin to existing lockfile resolutions: 0.208.0 exporter train (transitively present via langchain) and dominant 2.6.1 SDKs — the hand-edited importer block reuses the existing peer-suffixed snapshots (@opentelemetry/api@1.9.0), zero package-entry churn.

## Lockfile approach

Commit 1's `pnpm install --lockfile-only` was churn-free (+30 importer lines only). Commits 2 and 3's runs re-resolved/deduped unrelated transitive entries (semver 7.7.x/7.8.0→7.8.5, undici 6.21.3→6.28.0, ajv-formats 8.18.0→8.20.0 variants, optional-flag flips on cacache transitive @gar/promisify/infer-owner/promise-inflight), so per the playbook the lockfile was reverted and the cmd/gizzi-code importer block hand-edited to reference already-resolved entries (exact specifier/version pairs extracted from pnpm's own output first). Cumulative diff vs main: 120 insertions, 0 deletions — importer additions only.

## Verification evidence

- pnpm install --frozen-lockfile exit 0 (after each commit's lockfile state)
- bash script/ensure-sdk-dist.sh + NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit → exit 0 (os-contracts dist rebuilt by preflight)
- bun run test → 1311 pass / 0 fail / 42 skip across 107 files, SMOKE PASS: 107 entries green
- node scripts/release-preflight.mjs → 52 passed, 0 failed

## Incidents / notes

- The b0012 burn worktree (allternit-ao-tsburn-b0012) still exists on its branch; its PR #622 merged before this PR — no interaction.
- Pre-existing peer warnings during install (react 19.2.3 vs 19.2.4 unmet peer, @types/react) — pre-existing, not introduced here.
- Nothing deferred; scope complete. Desktop rebuild (lifecycle step 8) not applicable — no desktop-bundled source changed beyond already-declared deps in gizzi-code's package manifest (deps-only change, no src changes).
