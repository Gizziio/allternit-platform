# Plan — P2 quick wins (session/p2wins-0911)

Session F, 2026-09-11. From origin/main @ 474348b40. Three items, locked scope.

## 1. IndexedDB file versions (mapping doc §3 port #4, open-design .file-versions)

- [x] `src/lib/design/project-file-store.ts`: DB version 1 → 2, upgrade creates `fileVersions` store.
      Records: `{ id: `${projectId}:${path}`, projectId, path, versions: [{ hash, content, savedAt }] }`.
- [x] `writeProjectFile` appends versions (djb2 string hash), cap 10/file (drop oldest).
- [x] New APIs: `listFileVersions(projectId, path)`, `restoreFileVersion(projectId, path, index)`.
- [x] UI: History affordance in `src/views/design/ProjectFileWorkspace.tsx` (popover: timestamps + restore), inline-style conventions.
- [x] Tests: `project-file-store.test.ts` with store-aware fake-IndexedDB (gallery-store.test.ts fake only supports one store name — generalize). Cover: accumulate, cap at 10, restore content, v1→v2 upgrade doesn't crash.

## 2. Team tab honesty label (mapping doc §2 row 15)

- [x] Plain Register 1 in-tab notice in Team tab content (host: DesignTeamWorkspace.tsx): multiplayer not available yet; tab is a layout preview only.

## 3. Artifact sandbox policy codified (mapping doc §2 row 9)

- [x] Audit `src/components/artifact/ArtifactRenderer.tsx`: confirm no `allow-same-origin`, no storage access, note CSP absence.
- [x] DESIGN.md (under surfaces/ai.allternit.com/): "Artifact sandbox" section — enforced vs advisory, storage shim, no-allow-same-origin rationale, rule for new renderers.
- [x] If a real hole: fix in code. CSP tightening (not currently set) → `gh issue create` follow-up.

## Verification gate

- [x] `pnpm typecheck` 0 errors.
- [x] `pnpm vitest run src/lib/design src/shell src/views/design` all green (baseline 66/66, 12 files — only add).

## Ritual

- [ ] checkpoint.md start + end; conventional commits; push; `gh pr create` (real summary + verification); `gh pr merge --merge`.
- [ ] `node scripts/release-preflight.mjs` 26/0.
- [ ] Desktop rebuild from worktree (copy resources/bin from shared checkout; `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist`, background, wait for notification).
- [ ] Bundle grep for unique marker in release/mac-arm64 .../platform/assets/.
- [ ] Copy DMGs to shared checkout release/; retire only previously-latest set.
- [ ] Ledger branch session/ledger-p2wins-0911: summary + LEDGER.md bullet; PR; merge.
- [ ] Cleanup: worktree remove, delete session + ledger branches local + remote.
