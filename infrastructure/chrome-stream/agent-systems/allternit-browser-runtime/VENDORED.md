# Allternit Browser Runtime — vendored fork of Browserbase Stagehand v4

This directory is a **vendor fork** of [browserbase/stagehand](https://github.com/browserbase/stagehand),
a re-branded, self-hosted browser runtime driving local Chrome through a side-loaded
MV3 extension. It exists so the Allternit computer-use stack owns its browser-runtime
wire protocol end to end (sdk ↔ extension are protocol-version-paired).

## Provenance

| | |
|---|---|
| Upstream repo | `https://github.com/browserbase/stagehand` |
| Upstream commit | `b771930d2b4d858e5bd9670203c66260b385a8fa` (`docs: pin quickstart Zod to compatible 4.4 minor (#2922)`) |
| Vendored from | `@browserbasehq/stagehand` v4.1.0 (sdk-ts) / `@browserbasehq/stagehand-protocol` v2.0.0 / extension v1.0.2 |
| Date vendored | 2026-09-11 |
| Vendored packages | `packages/sdk-ts`, `packages/extension`, `packages/protocol` only |
| Deliberately NOT vendored | sdk-python, sdk-go, integrations, docs, evals, upstream tests/examples |

## License

MIT. The upstream copyright notice is retained in [`LICENSE`](./LICENSE):

> Copyright (c) 2024 Browserbase, Inc.

Modifications by Allternit LLC (2026) are also MIT. Keep the Browserbase copyright
notice in place on every re-vendor.

## Toolchain (kept separate on purpose)

- **Node ≥ 22.18 required** (engines field). Built and smoke-tested with **Node v26.5.0**
  and **pnpm 11.15.0** on macOS (2026-09-11).
- This directory has **its own pnpm workspace + lockfile** and is excluded from the
  repo root workspace (`!infrastructure/chrome-stream/agent-systems/allternit-browser-runtime`
  in root `pnpm-workspace.yaml`). Do NOT remove that exclusion: the sibling
  `@allternit/browser` package is a Node-18 toolchain and the two must not merge.
- Build: `pnpm install && pnpm run build` (extension via vite, sdk via tsdown which
  copies the built extension + zip into `packages/sdk-ts/dist/`).

## Layout

```
packages/sdk-ts      → npm package @allternit/browser-runtime (Node SDK, localBrowser factory, CDP client)
packages/extension   → MV3 Chrome extension (service worker + content script; private package)
packages/protocol    → zod JSON-RPC wire schemas shared by both (private package)
```

`localBrowser.launch()` spawns installed Chrome with the side-loaded extension;
`localBrowser.connect({ cdpUrl })` attaches to a running Chrome. Both fully work
in this fork. The `browserbase` session factory (remote Browserbase sessions via
`@browserbasehq/sdk`) is retained for upstream-fidelity but is inert self-hosted —
it requires a Browserbase API key and is not part of the Allternit runtime path.

## Rename map (apply on every re-vendor)

Mechanical renames applied across `packages/{sdk-ts,extension,protocol}`:

| Upstream | Fork |
|---|---|
| npm `@browserbasehq/stagehand` | `@allternit/browser-runtime` |
| npm `@browserbasehq/stagehand-protocol` | `@allternit/browser-runtime-protocol` |
| npm `@browserbasehq/stagehand-extension` | `@allternit/browser-runtime-extension` |
| Extension manifest `name` (`"Stagehand Runtime"`) | `"Allternit Browser Runtime"` |
| SDK `STAGEHAND_EXTENSION_NAME` value (CDP target discovery matcher) | `"Allternit Browser Runtime"` |
| Host→worker global `__stagehandReceiveFromHost` | `__allternitBrowserReceiveFromHost` |
| Binding value `__stagehandSendToHost` | `__allternitBrowserSendToHost` |
| TS constant `STAGEHAND_SEND_TO_HOST_BINDING` | `ALLTERNIT_BROWSER_SEND_TO_HOST_BINDING` |
| Service-worker artifact `service-worker.js` (vite input key, manifest `background.service_worker`, SDK `workerUrlIncludes` default) | `allternit-browser-service-worker.js` |
| Extension zip `stagehand-extension.zip` (vite artifact, tsdown copy, SDK default archive path) | `allternit-browser-extension.zip` |
| Tracer name `"@browserbasehq/stagehand"` | `"@allternit/browser-runtime"` |
| SDK identity `stagehand-sdk-ts` | `allternit-browser-runtime-sdk-ts` |
| Session metadata keys `stagehand`, `stagehand_sdk_language`, `stagehand_sdk_version` | `allternit_browser_runtime[_sdk_language/_sdk_version]` |
| Log prefix `[stagehand]` (SDK `renderStagehandLog`, extension `console.error` prefixes) | `[allternit-browser]` |
| Wire `RuntimeDescriptor.serverInfo.name` literal `"stagehand"` (protocol zod schema) | `"allternit-browser-runtime"` |
| Extension `serverInfo.name` value | `"allternit-browser-runtime"` |
| User-facing error strings ("Stagehand extension is not installed…", "Multiple enabled Stagehand extensions…", "Upgrade the Stagehand SDK and the Stagehand extension…") | "Allternit Browser Runtime …" equivalents |

**Not renamed (deliberately):** all other `STAGEHAND_*` TS identifiers, class names
(`Stagehand`, `StagehandRuntimeIncompatibleError`, …), RPC method names
(`stagehand.act`, `stagehand.observe`, `stagehand.llm.generate`, …), protocol schema
ids, `stagehand.v4.json`, and env overrides (`STAGEHAND_EXTENSION_ARCHIVE_PATH`,
`STAGEHAND_EXTENSION_DIRECTORY_PATH`). They are internal-only (or protocol-paired on
both sides from the same vendored tree) and renaming them adds re-vendor risk for no
residency benefit. The `wake-service-worker.{html,js}` and
`offscreen/service-worker-heartbeat.*` artifact names are unchanged (referenced
consistently on both sides).

## Browserbase-coupled paths stripped (self-hosted residency)

1. **Model Gateway client (`auto` model path)** — `packages/extension/llm/gatewayClient.ts`
   deleted; `services/llmService.ts` no longer takes a gateway context. Model inference
   now requires an explicit provider `ModelConfig` (apiKey) or a client-model callback
   (`model: { generate }` in the SDK — calls bounce to the host process over JSON-RPC).
2. **Server-side cache posts** — `packages/extension/services/cacheService.ts` and
   `packages/extension/clients/cacheClient.ts` deleted; act/observe/extract services run
   their inference pipelines directly and always report `disabledCacheMetadata()`.
   `clients/stagehandApi.ts` (regional `api.*.stagehand.browserbase.com` URLs) deleted
   as its only consumers were the gateway and the cache.
3. **`browserbase.fetch` / `browserbase.search` add-ons** — SDK `browser/browserbaseServices.ts`
   deleted; the `search`/`fetch` methods are removed from the `browserbase` browser
   factory and their schemas/exports removed from `clientSchemas.ts` / `index.ts`.

Everything stripped was best-effort/add-on functionality; no core act/observe/extract/
batch path depended on it.

## Re-vendoring procedure

1. `git clone https://github.com/browserbase/stagehand /tmp/stagehand-vendor && cd /tmp/stagehand-vendor && git checkout <pin>`
2. Copy `packages/{sdk-ts,extension,protocol}` (minus `node_modules`, `dist`, `artifacts`,
   `tests`, `examples`, and any `*.test.ts` / `*.test-d.ts` files) over this directory's
   `packages/`, and copy `LICENSE`.
3. Apply the rename map above (sed-able except the service-worker vite input key,
   sdkIdentity metadata keys, and `RuntimeDescriptor.serverInfo.name` literal — those are
   listed explicitly).
4. Re-apply the three strips (this file documents exactly which files to delete and
   which call sites to edit; the diff of the previous vendor is the reference).
5. Fix `package.json` names to the fork names, trim test scripts/devDeps, keep
   `publint` (tsdown runs it).
6. `pnpm install && pnpm run build && pnpm run typecheck`, then run
   `packages/sdk-ts/scripts/smoke-stagehand.ts` (see below).

## Smoke test

`packages/sdk-ts/scripts/smoke-stagehand.ts` launches local Chrome with the forked
extension, serves a static test page from localhost, and prints PASS/FAIL for:
extension handshake, `act` (click), `observe`, `extract`, and a 3-step
`experimentalBatch`. Model inference uses the SDK client-model callback. Run with a
real key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY` in env) or `--mock-model` for canned
structured outputs:

```
node packages/sdk-ts/scripts/smoke-stagehand.ts [--mock-model]
```
