# 2026-09-12 — Fabric Transport: rail switcher labels, dock revert, highlight fix

- **Session:** ao (Kimi Code), worktree `fabric-mode-labels-0912`
- **PR:** #420 (`69236bb29`, merged)
- **Deployed:** fabrictransport.allternit.com PWA SW **v42** (wrangler pages deploy from the worktree at merged main, commit-hash `69236bb29`)

## What was done

Eoj's review of the mode toggles surfaced three issues:

1. **Rail switcher labels** — the fabric shell-rail mode-switcher widget now reads **Home / Bots / Code / ACI**: the chat drive kind's label in `FABRIC_DRIVE_KINDS` changed Chat → Home, which also updates the rail tabs and section headers (all read the same source).
2. **Composer dock reverted** — #414's rename of the dock's first segment to 'Home' was wrong; the composer dock stays **Chat / Cowork / Bots** (BottomDock label + aria-label + tests reverted; the desktop app, which shares the component, gets its original labels back).
3. **Bots-highlighted-Cowork bug** — the `allternit:switch-mode` handler only reset the chat canvas for mode `'chat'`, so after visiting Cowork, selecting Bots left `chatView === 'cowork'`, which kept mirroring `'cowork'` into the app mode and the dock toggle highlighted Cowork. Any non-cowork mode now resets the chat canvas before mapping the drive kind.

SW cache v41 → v42.

## Verification

- `pnpm --filter @allternit/ai typecheck` — 0 errors ✅
- `vitest run src/components/dispatch src/views/chat/components/BottomDock.test.tsx src/lib` — 1146 passed ✅
- Vite fabric-session build + `prepare-fabric-session-pwa.mjs` ✅ (SW v42)
- Live post-deploy: SW = v42, web-proxy = 200
