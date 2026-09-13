# 2026-09-12 — Fabric Transport: composer mode toggle switches canvas; Chat → Home

- **Session:** ao (Kimi Code), worktree `fabric-cowork-switch-0912`
- **PR:** #414 (`3e2c58bf9`, merged)
- **Deployed:** fabrictransport.allternit.com PWA SW **v41** (wrangler pages deploy from the worktree at merged main, commit-hash `3e2c58bf9`)

## What was done

Eoj reported the composer dock's mode switcher didn't change the view on Fabric Transport, and asked for the switcher's "Chat" segment to be renamed "Home".

- **Root cause:** the dock (`BottomDock.ChatCoworkToggle`) dispatches `allternit:switch-mode`; `FabricSessionPanel` mapped it only through `fabricAppModeKind`, which collapses `cowork` into the chat drive kind — so selecting Cowork never flipped the canvas (dead click).
- **Fix:** the panel's switch-mode handler now routes `cowork` → chat kind + cowork canvas (clearing any selected node session) and `chat` → chat canvas, matching the desktop shell's mode-change semantics. The mirrored app mode (`setMode`) now also reflects the cowork canvas so the toggle highlights the matching segment instead of Home-while-cowork.
- **Rename:** BottomDock segment `Chat` → `Home` (label + group aria-label + tests). This component is shared, so the desktop app gets the same rename.
- SW cache v40 → v41.

## Verification

- `pnpm --filter @allternit/ai typecheck` ✅ (0 errors)
- `vitest run src/components/dispatch src/views/chat/components/BottomDock.test.tsx` — 17 passed ✅ (tests updated for the Home label)
- Vite fabric-session build + `prepare-fabric-session-pwa.mjs` ✅ (SW v41)
- Live post-deploy: SW = v41, web-proxy still 200

## Notes

- Desktop app binary not rebuilt; BottomDock change will ride the next desktop release.
