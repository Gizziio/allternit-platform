# session/kimi-fabric-rt-0925 — forward runtimeId into fabric-session window

**Did:** `openFabricSessionWindow()` (surfaces/allternit-desktop/src/main/unified-main.ts) now accepts `runtimeId` and appends `?runtime=` to the dashboard URL; both IPC handlers (`shell:open-fabric-session`, `shell:open-remote-control`) and the preload bridge (`openFabricSession`/`openRemoteControl`) forward the renderer's argument. Previously the arg was silently dropped, so the expanded Fabric Session window never preselected the machine.

**Verification:** `tsc --noEmit` clean in surfaces/allternit-desktop (node_modules symlinked from the main checkout); `release-preflight.mjs` 52/0. PR #733, merge SHA 2ee865c47ceb0e03ae75461ef5246d7c76d34a6c.

**Deferred (honest):** the installed `/Applications/Allternit Desktop.app` was NOT rebuilt — this is a main-process change and only takes effect after an electron-builder rebuild + reinstall. Companion UI changes live in the allternit-ai repo (local commits 48171b86, f1184571, c56e5985, unpushed because local main carries another session's unpushed commit).
