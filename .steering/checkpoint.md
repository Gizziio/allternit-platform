# Steering checkpoint — session/shell-rail-home-cleanup

Goal: Home-mode shell rail cleanup in the Allternit desktop surface
(`surfaces/ai.allternit.com`): remove collapsed-rail mascot pill, move Groups
to a bot-mode-only tab, fold Inbox into the (renamed) Bot Activity widget, move
Remote peers into the Fabric Transport view, inline the New button with the
tabs, move "Continue CLI session" into Recents (home + code), sticky tab
highlights, rename Agent Activity → Bot Activity everywhere user-visible.

Just did: re-applied the full edit set on top of newer origin/main
(2c7d3c990) after an outside process checked out origin/main in this worktree
and wiped the first (never-committed) pass. Reconciled with upstream
effe862b5 (mascot pill had been folded into the 44px collapsed-controls row —
removed from there) and kept upstream's `aci-recordings` browser view type.
Verification: typecheck:fast clean except the pre-existing unrelated error set
(office-* asset declarations, UnifiedTerminal xterm css); 31/31 targeted
vitest pass. A packaged build of the first pass exists at
`surfaces/allternit-desktop/release/Allternit-Desktop-1.1.0-arm64.dmg`
(unsigned, arm64) and was bundle-verified.

Next: commit on `session/shell-rail-home-cleanup`; user decides on PR/merge.
Packaged binary from the first pass predates the rebase but is functionally
identical (re-application verified equivalent); rebuild after merge if wanted.

Open questions: whether to PR/merge per the normal ritual (user said
edits + binary only so far). Note: the vite.config.ts PREVIEW-ONLY univerjs
patch from the earlier preview session did not survive the checkout — the
build of this branch may need that path fix re-staged locally.
