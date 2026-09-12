# session/cu16-stagehand — P0: Vendored Stagehand v4 fork as @allternit/browser-runtime

- **Date:** 2026-09-12
- **Agent family:** kimi-code
- **Spec:** `Allternit Brain/Research/specs/stagehand-batch-fork.md` (draft, human-approved direction; execution of P0 authorized by Eoj "merge … complete it")
- **Branch:** `session/cu16-stagehand` → **PR #415**, merge commit `47a360134` (merge commit style per repo ritual)
- **Commits:** `64adaa07b` (vendor+rename+strip), `6700aa7d2` (sidecar+smoke+VENDORED.md), + docs fix `pnpm-workspace`/smoke-invocation note on rebase

## What was done

Phase P0 of the stagehand-batch-fork spec: vendor-fork Browserbase Stagehand v4.1.0 (MIT) at pinned commit `b771930d2b4d858e5bd9670203c66260b385a8fa` into the platform as `@allternit/browser-runtime`.

- Vendored `packages/{sdk-ts,extension,protocol}` only (skipped sdk-python/sdk-go/integrations/docs/evals).
- Full re-brand (required — "Stagehand" is a Browserbase trademark; MIT permits the fork, not the name): package names → `@allternit/browser-runtime(-protocol/-extension)`, extension manifest → `Allternit Browser Runtime`, host global `__stagehandReceiveFromHost` → `__allternitBrowserReceiveFromHost`, send binding, service-worker artifact/zip names, tracer, log prefix, wire `serverInfo.name`, user-facing error strings. Internal `STAGEHAND_*` env/identifiers and RPC method names deliberately kept (documented in `VENDORED.md`).
- Strips for self-hosted residency: Model Gateway `auto` path (now throws without explicit model), server-side cache posts (`api.stagehand.browserbase.com`), regional API client, `browserbase.fetch/search`. `localBrowser.launch()`/`connect({cdpUrl})` intact.
- Toolchain isolation: own pnpm workspace, excluded from root workspace (`pnpm-workspace.yaml`) — sibling `@allternit/browser` is Node 18, the fork needs Node ≥22.18 (built/smoked on Node v26.5.0, pnpm 11.15).
- Filled the pre-cut `createStagehandProvider()` stub (`infrastructure/chrome-stream/agent-systems/allternit-browser/src/protocol/remote-provider.ts`) with a lazy stdio-NDJSON sidecar provider; `BrowserProvider` interface unchanged; provider kind stays `'stagehand'` (already declared in `@allternit/computer-use-protocol`). navigate/click/type/press/scroll/select/hover/extract/screenshot/wait mapped; dialogs/tabs/files return explicit unsupported errors (P1).

## How it works

The fork is upstream v4 architecture: an MV3 Chrome extension (service worker) owns the page over raw CDP; the SDK finds the service-worker target and issues every call as one `Runtime.evaluate` of the renamed receive-global; responses return via the renamed binding. sdk↔extension are protocol-version-paired (`runtimeCompatibility.ts`) — the rename had to be consistent or the handshake refuses. The sidecar wraps the SDK as a stdio NDJSON child process so the Node-18 `@allternit/browser` package can drive it without a toolchain merge.

## Verification evidence

- Rebased onto origin/main before PR (one conflict: `.steering/checkpoint.md` — took main's; root `pnpm-workspace.yaml` exclusion applied cleanly).
- Runtime `pnpm run typecheck` + `pnpm run build` (vite extension → tsdown SDK + publint) green on rebased base.
- `@allternit/browser` `npx vitest run`: **89 passed / 0 failed** (existing `remote-provider.test.ts` still passes).
- Smoke (`packages/sdk-ts/scripts/smoke-stagehand.ts --mock-model`, via `npx tsx` — plain `node` fails since tsdown emits `dist/` not `src/*.js`; doc fixed in-PR): **6/6 PASS** — init+extension handshake (protocol 2.0.0 ↔ 2.0.0, server `allternit-browser-runtime/1.0.2`), act (counter 0→1), observe (2 actions), extract, `experimentalBatch` 3 sequential steps `[true,true,true]` counter=3 flag=on, provider stub over sidecar (navigate+click+observe).
- CI: 12/12 checks green on PR #415 (typecheck, desktop vitest, secret scans, dependency audit, etc.).
- Smoke ran in `--mock-model` mode (no `OPENAI_API_KEY`/`ANTHROPIC_API_KEY` in the build env). Real-key mode is implemented but **unexercised** — P1 routes inference through the allternit gateway regardless.

## Incidents / surprises

- First worker hit a 5-hour model quota mid-run after vendoring; resumed next window with full context, no work lost.
- `runtimeCompatibility.ts` runtime-name literal was missed by the initial rename list; the protocol handshake itself caught it (the pairing check working as intended).
- Upstream layout differed from the earlier source audit: `extension/` and `protocol/` live under `packages/` at this commit; extension imports SDK source directly (cross-package), which is why one inert upstream Browserbase URL constant still appears in the built service worker (P1 scrub).
- pnpm 11 silently wrote a placeholder `allowBuilds` block into the vendored `pnpm-workspace.yaml` on a failed install → duplicate-key error on retry; cleaned.

## Honest deferrals (P1+)

- Model inference not yet routed through the allternit gateway (mock / direct provider key only).
- Dialogs/tabs/files ActionIntent coverage; screenshot artifact hashing.
- Inert upstream Browserbase URL constant in built service worker (documented in `VENDORED.md`).
- Batch grant gate (Rust `aci_approvals` batch descriptor), engine planning-loop consumption, session-preservation contract, batch success-rate measurement — P1/P2/P3 of the spec, subsequent sessions.
