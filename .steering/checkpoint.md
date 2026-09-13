# Steering checkpoint — session/onlook-ast-0912

Goal: AST two-way binding (Onlook-style, scoped MVP) — surgical edits write back into artifact
HTML source deterministically and re-render without an agent round-trip. Web surface only; desktop
rebuild REQUIRED afterward.

Just did: implemented src/lib/design/ast-binding.ts (position-tracking tolerant scanner;
locateElement with exact injectAioIds numbering parity + first-match-wins; applyElementEdit with
setText/setAttributes/removeAttributes/innerHtml, byte-for-byte preservation outside target,
idempotent; implied-end-tag autoclose for p/li/tr/td/etc.) + 36-test vitest suite (all green).
Wired in-place edit box into SurgicalEditPanel (Text/Attribute/Inner HTML modes) and DesignModeView
(astPatch override feeding preview/surgical prompt/HyperFrames/critique; auto-invalidates when the
agent produces a new artifact). Verified: pnpm typecheck 0 errors; vitest src/lib/design
src/components/artifact src/views/design 155/155; release-preflight 35/0.

Next: commit + push, merge newest origin/main, PR with gh pr merge --merge, ledger attestation via
own branch/PR, then desktop rebuild (fresh gizzi-code binary staged from this worktree, background
npm run dist, bundle-grep applyElementEdit, preserve 8-file set, retire only previous latest).

Open questions: none. Siblings untouched (no edits to content-artifact-sync, gallery-store,
project-file-store, DesignCritiquePanel, critique routes, LibraryItemDialog, Rust).
