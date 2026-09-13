# Session attestation — artphase2-0912 (A:// Artifacts API Phase 2: cross-surface consumption)

- **Session:** `artphase2-0912` (parallel session; sibling `designfixes-0912` merged first as PR #416)
- **PR:** #418 — merge commit `8abc71e76`
- **Issue:** #388 (commented through the session, closed on merge)
- **Prior phase:** Phase 1 landed as PR #411 (session `artphase1-0912`) — gateway CRUD at `/api/v1/content-artifacts` + design-session persistence.

## What was done (Phase 2 scope, docs/design/artifacts-api.md §7)

1. **IndexedDB demoted to read-through cache** (owned files):
   - New `surfaces/ai.allternit.com/src/lib/design/content-artifact-api.ts` — raw gateway client (list/get/create/append-version/soft-delete + `a://artifact/<id>` address parse/split), no store dependencies.
   - `gallery-store.ts` — `listGalleryEntries` gateway-first (gateway rows populate the cache, IndexedDB answers on gateway failure, local-only entries kept); `upsertGalleryEntry` writes IndexedDB then best-effort write-through (create v1 / append version; idempotency keys `gallery-create-<projectId>` / `gallery-append-<projectId>-<updatedAt>`); `deleteGalleryEntry` soft-deletes on the gateway. `syncGalleryEntryToGateway` exported.
   - `project-file-store.ts` — `/index.html` (PROJECT_ARTIFACT_PATH) read/write-throughs to the project's gateway artifact (append idempotency content-hashed); the rest of the file tree stays local — the gateway has no multi-file model in Phase 2 (honest bound, recorded here).
   - `content-artifact-sync.ts` — Phase 1 entry points kept as thin delegates so DesignModeView/NewProjectScreen are unchanged; the explicit save pass after upsert dedupes server-side via identical idempotency keys.
2. **Chat persist step** — `ArtifactSidePanel` gains "Save to artifacts": persists renderable kinds (html/svg/document/mermaid/openui) via the API with `sourceSessionId` provenance (wired from ChatView's `activeComposerSessionId`) and shows the minted `a://artifact/<id>` address.
3. **Cowork `a://artifact/<id>` links** — `ArtifactAddressCard` (components/artifact): fetch-on-expand from the local gateway, renders in the same sandboxed iframe. Wired into `UnifiedMessageRenderer` text parts (the live transcript path used by cowork + chat) and `CoworkStreamBlock`.
4. **gizzi-code `artifact` client commands** — `gizzi artifact list [--type --project --q --limit]` / `show <id> [--version n] [--body-only]` (accepts full `a://artifact/<id>` addresses; `--version` collided with yargs' global flag → `.version(false)` on the show command) / `save --title --type (--file | --stdin | --body) [--project-id --prompt]`. Client fns in `runtime/services/api/allternitApi.ts` with device-token config, following the `html-artifact` pattern. Registered in `commands/registry.ts`.
5. **Typed renderers — §2.1 DECIDED** — `application/vnd.allternit.deck`: chrome bar with live slide counter fed by deck-stage `slideIndexChanged` postMessage (opaque-origin validated like aio-targeting) + prev/next via iframe `#slide-N` hash nav. `.mobile`: 390px device frame. `.prototype`: pinned to the standard sandboxed iframe (hotspot linking is in-document anchors). Decision + reasoning written into `docs/design/artifacts-api.md` §2.1 (marked DECIDED 2026-09-12). Sandbox policy byte-identical (no allow-same-origin, CSP untouched).

## How it works (architecture)

Gateway canonical, IndexedDB cache. All web-surface traffic funnels through `content-artifact-api.ts`; stores add cache semantics, UI adds persist/resolve chrome, CLI adds a thin HTTP adapter. Idempotency keys make the double-write paths (upsert + explicit sync pass; retried saves) server-side no-ops. Everything degrades to local-only when the gateway is down — no surface hard-depends on the network.

## Verification evidence

- `pnpm typecheck` (surfaces/ai.allternit.com): 0 errors (post-merge with sibling PR #417/#416 content).
- `pnpm vitest run src/lib/design src/views/design src/components/design src/components/artifact`: 119/119 green across 14 files (post-merge, includes sibling's gallery-view tests).
- `bun run typecheck` + `bun run script/build-production.js` (cmd/gizzi-code): green; `gizzi artifact --help` exercises in the bundled binary.
- `node scripts/release-preflight.mjs`: 35 passed, 0 failed.
- Live smoke against a scratch allternit-api (worktree debug build, `ALLTERNIT_API_PORT=18013 ALLTERNIT_LOCAL_DEV_BYPASS=1`, scratch `ALLTERNIT_DATA_DIR`): curl create 201 with `a://artifact/…` → idempotent replay 200 → append v2 → read v1 inline → type filter → soft-delete excludes from list. CLI: `save` → `list` → `show a://artifact/<id> --body-only` → `show --version 1 --body-only` all round-trip. NOTE: the process listening on :8013 on this machine is a static SPA server, not allternit-api — that is why the scratch port.
- `cargo test -p allternit-api`: 987 passed, 5 failed — exactly the proven pre-existing set from PR #411 (4× `agent_cloud provision_*` "did not log its listening port", `rails::gate_data_plane_round_trip`); no new failures. No Rust changes in this PR.
- Desktop rebuild: fresh gizzi-code production binary built from the worktree (includes sibling #416 `/v1/design/ack` — verified by strings grep for `design-prompt-ack.json`) staged into `resources/bin/gizzi-code` (the shared-checkout sidecar was stale pre-#416); `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist` background build; bundle marker greps (see build number in LEDGER follow-up if this summary lands before the build finished — build evidence appended to this file if so).

## Incidents / notes

- File-ownership ambiguity: shared-setup §6 listed artphase2's scope as "sibling owns", contradicting both per-session specs (which agree with each other). Followed the per-session split; sibling's checkpoint independently confirms it. Noted in PR #418 body.
- CoworkStreamBlock.tsx turned out to be unreferenced by any live transcript path; the a:// wiring therefore also landed in UnifiedMessageRenderer (used by StreamingChatComposer ← CoworkTranscript). CoworkStreamBlock wiring kept for when parts rendering is revived.
- `--version` flag collision caught by the live CLI smoke, not by typecheck — worth remembering for future yargs subcommands.

## Honest deferrals

- **Phase 3 publish tiers (#389)** — explicitly not this session. §6 publish decisions are DECIDED (shared Pages project, per-user routes, version-snapshot publish, immutable deployments, sandbox-gated publish) awaiting a Phase 3 builder.
- **Org relay tier** — decided (new local id on receive, origin id in provenance; standard sandbox for received artifacts) but unscheduled.
- **Multi-file project trees on the gateway** — project-file-store only syncs the artifact file (`/index.html`); auxiliary project files remain IndexedDB-local until the gateway grows a file-tree model.
- **Non-renderable chat artifact kinds** (code/jsx/sheet) get no persist path by design decision (API is html-first); reversible if a plain-text artifact type is added.
