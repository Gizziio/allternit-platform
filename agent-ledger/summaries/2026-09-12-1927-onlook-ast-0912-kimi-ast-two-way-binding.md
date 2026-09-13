# Session summary — onlook-ast-0912 (AST two-way binding, web surface)

- **Date:** 2026-09-12 19:27
- **Agent:** kimi-code
- **Branch:** `session/onlook-ast-0912` → PR #437, merge commit `fb0d221e4`
- **Scope:** Port Onlook-style AST two-way binding (deferred non-goal from
  `surgicaleye-0911`, now in scope): surgical edits write BACK into artifact
  HTML source deterministically; preview re-renders without an agent
  round-trip. Web surface only. One of three parallel 0912 sessions
  (`relay-0912` Rust relay, `artpolish-0912` CSP/tree-sync/critique/wrangler).

## What was done

1. **`surfaces/ai.allternit.com/src/lib/design/ast-binding.ts`** (new, zero new
   dependencies — no HTML parser ships in this surface and none is needed):
   - Position-tracking tolerant scanner; edits splice on source offsets so
     everything outside the target element is preserved **byte-for-byte**.
   - `locateElement(html, aioId)` → `{ start, end, openEnd, tag, attrs,
     innerRange, selfClosing, void }` with **exact `injectAioIds` numbering
     parity** (source `data-aio-id`s win; otherwise document-order `aio-N`
     after `maxExistingAioId`; same skip rules for raw-text script/style/
     textarea/title, void/skip tags, comments/doctype/CDATA/PIs). Duplicate
     ids: first match in document order wins (documented).
   - `applyElementEdit(html, aioId, edit)` → `newHtml`: `setText` (escaped),
     `innerHtml` (raw), `setAttributes` (null removes; replacement preserves
     original quote style; insertions placed before a self-closing slash),
     `removeAttributes`. Idempotent per edit kind; `AstElementNotFoundError`
     on unknown ids; `innerHtml`+`setText` rejected as ambiguous; void/
     self-closing elements take attribute edits only.
   - Implied-end-tag autoclose (`p/li/dt/dd/tr/td/th/option/optgroup/thead/
     tbody/tfoot/caption/colgroup`) so editing one `<li>` cannot swallow its
     siblings; div/span-style nesting untouched.
   - Documented limitation: patching inner HTML that adds/removes targetable
     elements renumbers injected ids after the patch point on next render —
     re-target after an in-place edit.
2. **`src/components/design/SurgicalEditPanel.tsx`**: "Edit in place" box on
   the click-targeted element — Text / Attribute / Inner HTML modes, inline
   success/error feedback, not-found guidance when the source shifted.
3. **`src/views/design/DesignModeView.tsx`**: in-memory `astPatch` override
   (`baseHtml` + patched `html`) that feeds the preview, the surgical panel
   AND `buildSurgicalEditPrompt`, HyperFrames, and critique — agent-path
   edits build on the patched source. Auto-invalidates when the agent
   produces a new artifact. Agent prompt path remains the fallback.

Sibling file-ownership split respected: no edits to `content-artifact-sync.ts`,
`gallery-store.ts`, `project-file-store.ts`, `DesignCritiquePanel`,
`routes/critique.ts`, `LibraryItemDialog.tsx`, or Rust.

## Verification

- `pnpm typecheck` (surfaces/ai.allternit.com) — 0 errors.
- `pnpm vitest run src/lib/design src/components/artifact src/views/design` —
  **155/155 green** (15 files), including the new 36-test
  `ast-binding.test.ts`: nesting, duplicate-id first-match, void elements,
  quoted/`>`/unquoted/valueless attributes, lookalike `data-aio-id` inside
  attribute values, script/style/comment untouched, byte-preservation outside
  target, idempotency per edit kind, `setText` escaping, injection-numbering
  parity with `injectAioIds`, implied-end-tag autoclose (p/li), unclosed
  elements, fragments without html/head/body, not-found behavior.
- `node scripts/release-preflight.mjs` — **35 passed, 0 failed**.
- Re-verified typecheck + 155 tests after merging newest origin/main
  (`botmode-0912` attestation) before PR.

## Incidents

- Merge conflict in `.steering/checkpoint.md` with the rotated-in
  `botmode-0912` checkpoint — resolved per repo convention (mine kept,
  incoming rotated out with a note; botmode's content is preserved in git
  history).

## Deferrals (honest)

- In-place patches are in-memory for the session view (agent chat messages
  are not mutable from the web surface); persistence into the canonical
  artifact store is a follow-up. The patched source IS what flows into
  subsequent agent surgical-edit prompts in the same view.
- Desktop rebuild was REQUIRED by the spec and is performed after this
  attestation (see LEDGER follow-up if the DMG build failed).

## Update 2026-09-12 ~20:20 — desktop rebuild DONE (was listed as pending above)

- Fresh `gizzi-code` binary built from the merged tree (`cmd/gizzi-code`
  `bun run script/build-production.js`, sdk dist rebuilt first) and staged
  into `surfaces/allternit-desktop/resources/bin/gizzi-code`; other 5
  sidecars verified current (`allternit-api` rebuilt fresh from merged main
  during the run).
- First build attempt from the SHARED checkout failed at electron-builder
  (`NpmNodeModulesCollector` — that checkout's desktop `node_modules` is a
  stale standalone npm install). Re-ran from the session worktree
  (`pm=pnpm` collector succeeded there), as the botmode-0912 session did.
- Result: **build b2379**, 8 files (arm64/x64 × dmg/zip + blockmaps),
  copied to the shared `surfaces/allternit-desktop/release/`.
- Bundle verification: `grep -rl applyElementEdit` →
  `platform/assets/ArtifactRenderer-CkCWa5PQ.js` inside
  `release/mac-arm64/Allternit Desktop.app`.
- Retired ONLY the previous latest set: **b2313** (8 files). DMG is
  unsigned/unnotarized (no APPLE_ID creds), expected for local builds.
