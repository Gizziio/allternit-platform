# Plan — artphase2-0912: Artifacts API Phase 2 (cross-surface consumption)

Session branch: `session/artphase2-0912` from `origin/main` (00a186602 at creation).
Sibling session `designfixes-0912` owns: critique-panel image wiring, gallery view/
thumbnail layer, `/design` ack channel. This session owns: **gallery-store.ts,
project-file-store.ts** (read-through cache), chat persist step, cowork `a://`
links, gizzi-code artifact commands, typed renderers + `docs/design/artifacts-api.md`
§2.1 decision. Do not edit sibling files (gallery view components, DesignModeView
gallery capture, critique components).

## Work items

1. **Web lib — `content-artifact-api.ts` (new).** Raw gateway client for
   `/api/v1/content-artifacts` (list/get/create/append-version/soft-delete), no
   store imports. Shared by stores, chat persist, cowork links.

2. **Read-through cache — `gallery-store.ts` (owned).**
   - `upsertGalleryEntry`: IndexedDB write (unchanged shape) + best-effort
     write-through to gateway (create v1 or append version, fixed idempotency
     keys `gallery-create-<projectId>` / `gallery-append-<projectId>-<updatedAt>`).
   - `listGalleryEntries`: gateway-first; merge local cache (bodies/categories),
     keep local-only entries; IndexedDB fallback when gateway unreachable.
   - `getEntryByProjectId`: cache-first, gateway fill on miss.
   - `deleteGalleryEntry`: IndexedDB delete + best-effort gateway soft delete.
   - Export `syncGalleryEntryToGateway(entry)` for the sync module.
   - `content-artifact-sync.ts`: keep exported names (`saveGalleryEntryToGateway`,
     `listGalleryEntriesGatewayFirst`) as delegates over the store so existing
     callers (DesignModeView, NewProjectScreen) are unchanged; same idempotency
     keys make the double-write from DesignModeView a server-side no-op.
   - Update `gallery-store.test.ts` / `content-artifact-sync.test.ts` for the new
     semantics (api mocked).

3. **Read-through cache — `project-file-store.ts` (owned).** The project artifact
   file `/index.html` maps to the project's gateway content-artifact:
   - `writeProjectFile` on `/index.html`: IndexedDB write + best-effort gateway
     append-version/create (fire-and-forget with catch; must not break existing
     tests that run without a mocked api).
   - `loadProjectFiles`: IndexedDB cache-first; when `/index.html` is absent
     locally, fetch the project's artifact body from the gateway and populate.

4. **Chat persist step.** `saveChatArtifactToGateway({title, type, body,
   sourceSessionId, prompt?})` helper (uses content-artifact-api). "Save to
   artifacts" button in `ArtifactSidePanel` (components/ai-elements — not
   sibling-owned); ChatView passes the active chat session id through. Address of
   the saved artifact (`a://artifact/<id>`) shown after save.

5. **Cowork `a://artifact/<id>` links.** New `src/lib/design/artifact-address.ts`
   (`parseArtifactAddress`, fetch + `ArtifactAddressCard` component) resolving
   addresses to the local gateway artifact and rendering via the sandboxed
   ArtifactRenderer. Wire into `CoworkStreamBlock` TextBlock so cowork runs that
   emit `a://artifact/…` links render a resolvable card instead of dead text.
   Also artifact-producing cowork runs get a link form (best-effort: card covers
   resolution; creation provenance via API is already possible from chat persist).

6. **gizzi-code `artifact` commands.** `src/cli/commands/artifact.ts`:
   `gizzi artifact list [--type --project --q]`, `gizzi artifact show <id>
   [--version n] [--body-only]`, `gizzi artifact save --title … --type … (--file
   <path> | --stdin | --body …) [--project-id --prompt]` — thin client over
   `runtime/services/api/allternitApi.ts` (add content-artifact fns there,
   device-token config like html-artifact). Register in `commands/registry.ts`.
   Must pass `bun run typecheck` + `bun run script/build-production.js`.

7. **Typed renderers (§2.1 DECIDED).** `application/vnd.allternit.deck` /
   `.prototype` / `.mobile` get typed renderers in `ArtifactRenderer.tsx` as thin
   viewport/navigation wrappers over the same sandboxed HTMLRenderer (deck =
   slide nav overlay; mobile = 390px device frame; prototype = standard sandbox
   render — hotspot linking is in-document, renderer adds sandbox only). Storage
   model unchanged. Record the decision + reasoning in
   `docs/design/artifacts-api.md` §2.1 (mark DECIDED).

## Verification

- `pnpm typecheck` in surfaces/ai.allternit.com — 0 errors.
- `pnpm vitest run src/lib/design src/views/design src/components/design src/components/artifact` — green.
- `bun run typecheck` + `bun run script/build-production.js` in cmd/gizzi-code.
- `cargo test -p allternit-api` — only the proven pre-existing failures (4×
  `agent_cloud provision_*`, `rails::gate_data_plane_round_trip`, `claim_race` flake).
- Live curl smoke: run allternit-api locally, exercise create/list/get via the
  new CLI + curl (artifact commands + chat/cowork endpoints unchanged).
- `node scripts/release-preflight.mjs` — 35/0.
- Desktop rebuild per ritual (sidecar copy → background `npm run dist` → marker
  grep → preserve 8-file release set, retire previous latest only).
- `gh issue view 388` comment + close after merge.

## Ritual

Conventional commits, push, PR (real summary + evidence), `gh pr merge --merge`.
Then ledger: `session/ledger-artphase2-0912` branch off origin/main,
`agent-ledger/summaries/2026-09-12-HHMM-artphase2-0912-kimi-artifacts-phase2.md`,
one LEDGER.md line at END, PR + merge. Cleanup worktree + branches.
Deferrals: Phase 3 publish tiers (#389) not this session; relay tier decided,
unscheduled.
