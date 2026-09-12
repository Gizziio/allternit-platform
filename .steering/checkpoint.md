# Steering checkpoint

- **Goal:** Fabric Transport label/highlight fixes — rail switcher says Home/Bots/Code/ACI; composer dock stays Chat/Cowork/Bots; Bots selection must not highlight Cowork.
- **Just did:** Worktree `fabric-mode-labels-0912` off origin/main (`f9731c82c`). `fabric-session-kind.ts` chat kind label Chat → Home (feeds the rail switcher tooltips, rail tabs, section headers). Reverted #414's BottomDock rename back to Chat/Cowork/Bots (label, aria-label, tests). Fixed the stale-highlight bug: the switch-mode handler now resets chatView to 'chat' for ANY non-cowork mode (was only 'chat'), so a leftover cowork canvas no longer mirrors 'cowork' into the app mode while Bots is active. SW v41→v42. Typecheck 0 errors; vitest dispatch + BottomDock + lib suites 1146 passed; build + prepare verified v42.
- **Next:** PR, merge, deploy, confirm live v42, ledger, cleanup.
- **Open questions:** none.
