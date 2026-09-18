# Session summary: ao/cut-cloud-relay — cut zombie browser-extension↔agent WebSocket relay

**Date:** 2026-09-18 10:43
**Agent:** kimi-code (subagent, owner tasking)
**Branch:** `ao/cut-cloud-relay` → **PR #590**, merge `9e29e1389`
**Base:** origin/main @ 254a6f9b6 (fetched fresh; shim-triage PR #589 had landed, as briefed)

## What was done

Owner decision 2026-09-18: CUT the browser-extension↔agent WebSocket relay, following the
superconductor-cut precedent (PR #579). Basis: a read-only investigation memo verified zero live
consumers, no deployment mechanism anywhere, no CI, and no operational record of it ever serving
traffic. The extension's `cloud` mode pointed at `wss://api.allternit.com/v1/extension`, which no
server implements; nothing could enable the mode without hand-editing extension storage, and the
`CloudConnector` class had zero importers. Deployed successors already cover the use case:
extension↔Desktop native messaging, remote-control-push Worker, Fabric device relay, phone-remote.

Every checklist item was re-verified in the worktree before deletion (grep for importers/references,
port-3000 check on the e2e tests, dead `7-apps/` path confirmation on the shell scripts, workflow /
package.json / Makefile / docs reference sweeps).

### Deleted paths

- `api/core/cloud-backend/` — src/index.ts, src/auth.ts, src/test/auth.test.ts, package.json,
  tsconfig.json, bun.lock
- `surfaces/allternit-extensions/allternit-extension/src/browser-agent/cloud-connector.ts`
- `surfaces/docs/tools/cloud-backend.mdx`, `surfaces/docs/byoc/cloud-backend.mdx` (+ docs.json nav entries)
- `tests/e2e/test-extension-client.mjs`, `tests/e2e/test-full-e2e.mjs`,
  `tests/e2e/test-e2e-thin-client-extension.ts` (targeted ws://localhost:3000 of the deleted relay)
- `scripts/install.sh`, `scripts/install.ps1` (broken installers: dead 7-apps/ paths, config no
  code reads; only workflow hit was an unrelated gizzi-code release-assets comment)
- `tests/test-all-components.sh`, `tests/test-integration.sh` (dead 7-apps/ references)

### Extension cloud-mode removal (connection.ts + background.ts)

- Deleted `cloud-connector.ts`; re-verified `CloudConnector`/`initCloudConnector`/`getCloudConnector`
  had zero importers repo-wide.
- `connection.ts`: removed the unreachable `cloud` branch in `_connect`, `DEFAULT_CONFIG.cloudUrl`,
  the `StoredConfig` interface, the `'cloud'` member of the `ConnectionMode` union, the
  `wsClient` field and its disconnect path, and the `chrome.storage.local['allternitConnection']`
  reader in `initialize()` — the reader's only consumers were cloud-mode fields (mode/cloudUrl/
  authToken), verified no other consumer. `_sendToBackend` is now an explicit no-op with a comment
  (results reach the Desktop via the native-messaging response channel). The extension ends with
  ONLY the cowork/native-messaging mode.
- `background.ts`: updated the connection-channel header and setup comments.

### Stale pointers fixed

- `docs/projects/allternit-cloud/MASTER_TRACKING.md` (current path; root copy does not exist) —
  cut note on the Layer-3 checklist line; removed the bogus `cmd/cloud-backend/src/index.ts`
  table row (a stale pre-reorg path; that tree was itself cut in PR #582).
- `REPO_STRUCTURE.md`, `api/README.md` — cloud-backend drops out of remaining-live-packages lists.
- `docs/Core_System/01-Reality/SPEC-Reality-Infrastructure-Cloud.md §4` — marked REMOVED with
  successors named.

## Verification evidence

- `node scripts/release-preflight.mjs` → **52 passed, 0 failed**
- Lockfile: `pnpm install --lockfile-only` → exactly **25 deletions, 0 insertions** (single
  dropped `api/core/cloud-backend` importer block; no churn beyond that, did not STOP)
- Extension: `pnpm install --filter @allternit/extension...`, built workspace deps
  `@page-agent/{core,llms,page-controller,ui}` first (pre-existing build-order requirement),
  then `wxt build` ✔ chrome-mv3 2.06 MB; unit tests **19/19** (2 files)
- Grep sweeps: zero `wss://api.allternit.com/v1/extension` / `cloudUrl` / `CloudConnector` /
  `cloud-connector` in surfaces/allternit-extensions (source AND built .output background.js,
  0 hits each); repo-wide `cloud-backend` outside agent-ledger/archive = only the two intentional
  REMOVED/cut annotations
- `node scripts/docs-lint.cjs` → PASS (docs.json valid, nav pages exist, no orphan MDX)

## Incidents / honest deferrals

- Nothing refused: every deletion cleared its live-reference re-check.
- Stragglers intentionally left (docs-only, not in the named cut scope): `docs/audit/allternit-audit.md`
  (2 mentions), `docs/learnings/CODEBASE_DAG_CROSS_REFERENCE.md` (1 "UNKNOWN" mapping line).
- `src/lib/connection-status.ts` (extension) has an unrelated `'cloud'` status-literal and
  `cloudEndpoint` field with zero importers; not a relay artifact and not a named cut file — left.
- CommRails DAG planning and `.steering/checkpoint.md` not touched (owner task brief overrode;
  same precedent as PR #583). Desktop rebuild not required (nothing the desktop bundles changed —
  extension is not part of the desktop release path).
- Worktree `allternit-ao-cut-relay` removed, branch `ao/cut-cloud-relay` deleted local+remote
  after merge per lifecycle step 9.
