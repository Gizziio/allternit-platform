# Steering checkpoint

- **Goal:** Fabric Transport — composer Home/Cowork/Bots toggle must switch the canvas (cowork was a dead click); rename the switcher's "Chat" segment to "Home".
- **Just did:** Worktree `fabric-cowork-switch-0912` off origin/main (`00a186602`). `FabricSessionPanel` `allternit:switch-mode` handler now routes `cowork` → chat kind + cowork canvas (+ clears node session selection), `chat` → chat canvas; app-mode mirror reflects the cowork canvas so the toggle highlights the right segment. `BottomDock` segment label Chat → Home (aria-label too) + tests updated. SW v40→v41. Typecheck ✅, BottomDock + dispatch tests 17 passed ✅, build + prepare verified v41.
- **Next:** PR, merge, deploy, confirm live v41, ledger, cleanup.
- **Open questions:** none.
