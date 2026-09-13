# Plan — session/onlook-ast-0912 (AST two-way binding, web surface)

Worktree: allternit-session-onlook-ast-0912 @ origin/main 3fa88fb35.
Sibling sessions: relay-0912 (Rust relay), artpolish-0912 (CSP + tree sync + critique + wrangler smoke).
Ownership: I own SurgicalEditPanel.tsx, DesignModeView.tsx (surgical/aio side only), new
src/lib/design/ast-binding.ts (+ tests). MUST NOT touch: content-artifact-sync.ts, gallery-store.ts,
project-file-store.ts, DesignCritiquePanel, routes/critique.ts, LibraryItemDialog.tsx, any Rust.

## Goal

Onlook-style two-way binding, scoped MVP: surgical edits write BACK into the artifact HTML source
deterministically (no agent round-trip) and the preview re-renders. Agent prompt path stays as
fallback.

## Design decisions

- No new deps: no HTML parser in surfaces/ai.allternit.com/package.json and none needed — a small
  position-tracking tolerant scanner gives byte-for-byte preservation outside the target by
  construction (splice on source offsets, never re-serialize the document).
- Id scheme consistency: locateElement must resolve the SAME `aio-N` numbering injectAioIds
  assigns (ids present in source win; missing ones assigned in document order continuing after
  maxExistingAioId; same skip rules: void/skip tags, raw-text script/style/textarea/title,
  comments/CDATA/doctype/PI). Duplicate ids: first match in document order wins (documented).
- applyElementEdit(html, aioId, edit): throws on unknown aioId; supports setAttributes (value
  replace preserves existing quote style; null removes), removeAttributes, setText (inner HTML
  replaced by escaped text), innerHtml (raw replace). innerHtml+setText together = throw
  (ambiguous). Void/self-closing elements: attribute edits only; content edits are a no-op on
  content (deterministic). Idempotent by construction.
- UI wiring: DesignModeView keeps an in-memory `astPatched` override {baseHtml, html}; effective
  html = override when base still equals latestArtifactHtml, else latestArtifactHtml (override
  auto-invalidates when the agent produces a new artifact). Effective html feeds ArtifactRenderer,
  SurgicalEditPanel, HyperFrames, critique, and buildSurgicalEditPrompt so the agent path builds
  on the patched source. No persistence deferral: session-message artifacts are not mutable from
  the web surface; in-place patch is immediate re-render + downstream source-of-truth for prompts.
- SurgicalEditPanel: when a click-target seed arrives, show an "Edit in place" box (Text /
  Attribute / Inner HTML modes) calling onApplyInPlace(edit) prop; success/failure feedback shown
  inline. Existing comment flow untouched (fallback).

## Steps

- [x] src/lib/design/ast-binding.ts: scanner + locateElement + applyElementEdit (+ exported types,
      escape helpers, elementInnerText helper for text prefill).
- [x] src/lib/design/ast-binding.test.ts: 36 tests — nesting, duplicate ids first-match, void
      elements, attrs with quotes/`>`/unquoted/valueless, script/style/comments untouched,
      byte-preservation outside target, idempotency per edit kind, setText escaping,
      injection-numbering parity with injectAioIds, implied-end-tag autoclose (p/li), not-found.
- [x] SurgicalEditPanel.tsx: in-place edit box (Text / Attribute / Inner HTML modes; new optional
      props inPlaceTarget, onApplyInPlace; renumber warning + not-found guidance).
- [x] DesignModeView.tsx: astPatch override state + effective artifactHtml everywhere (preview,
      surgical panel + prompt, HyperFrames, critique); onApplyInPlace wiring.
- [x] Verify: pnpm typecheck 0 errors; pnpm vitest run src/lib/design src/components/artifact
      src/views/design green (155/155, 15 files); node scripts/release-preflight.mjs 35/0.
- [ ] Merge newest origin/main before PR; gh pr create + merge --merge; record PR + SHA.
- [ ] Ledger attestation on own branch/PR (shared checkout off-limits except pull --ff-only;
      steering says ledger via own branch/PR per session spec).
- [ ] Desktop rebuild: fresh gizzi-code binary (cmd/gizzi-code bun run script/build-production.js)
      staged into worktree surfaces/allternit-desktop/resources/bin/gizzi-code (+ copy other 5
      sidecars, NOT the shared checkout's stale gizzi-code), background
      CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist, wait for notification, bundle-grep
      applyElementEdit in platform/assets, preserve 8-file set to shared release/, retire only
      previous latest set.
- [ ] Cleanup: worktree remove, branch delete local+remote, final status.
