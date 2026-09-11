# Steering checkpoint — session/bbf3793b

## Goal
Extract Allternit Office from the ACI "Office & Extensions" tab (renamed "ACI Extensions") into a dedicated Electron window (mirroring the Design window UX) with the A://TERNIT OFFICE wordmark as header logo; ACI-mode bottom rail Design button becomes "Allternit Office" (other modes unchanged).

## Just did
- Phases 1-5 implemented in session worktree: office suite extracted from BrowserExtensionsView (now extensions-only "ACI Extensions"), new /office route + OfficeDesktopView + OfficePage with wordmark header (56px design-matched bar), shell:open-office-window IPC + preload openOfficeWindow + lib/open-office-window, ACI-only footer rail tab (small wordmark / collapsed mark when labels off; More-dropdown item swapped too), desktop-bridge launcher retargeted to the office window, DocumentsView pointer updated, docs + comments swept, tests reworked (office-hub helper → office-surface; office-extensions-view.spec → aci-extensions-view.spec with rail/window/popup tests; desktop office-windows.spec launcher test updated).
- pnpm install running in the fresh worktree (needed before typecheck).

## Next
- Verify: platform typecheck:fast + vitest shell/office, desktop typecheck + vitest, release-preflight, then commit/PR per ritual.

## Open questions
- Rail icon: full small wordmark (labels on) vs collapsed A:// mark (labels off) — chose this for rail width; owner can tune height.
