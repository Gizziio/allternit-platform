# Checkpoint — session/fabricfix-0911

**Goal:** Merge the verified fabric-session fixes (kernel /api/v1/fabric/* + /api/v1/session-worker/invoke local fallbacks in fabric_routes.rs; desktop auth-manager.ts relay intercepts) to main, then rebuild Desktop.app from merged main and redeploy the running app.

**Just did:** Copied the two changed files from the shared checkout (source of truth for the live fix) into a fresh worktree on origin/main. release-preflight 35/0 OK. cargo check running.

**Next:** commit → push → PR → merge --merge → attest ledger → rebuild desktop (npm run build + electron-builder --mac dmg, unsigned) → verify bundle → quit live app, replace release app + /Applications copy, relaunch, re-verify health + fabric probes.

**Open questions:** none — change already battle-tested on the live app 2026-09-11 (kernel healthy, 4 fabric endpoints 200 JSON, provider pool healthy, asar durable across relaunch).
