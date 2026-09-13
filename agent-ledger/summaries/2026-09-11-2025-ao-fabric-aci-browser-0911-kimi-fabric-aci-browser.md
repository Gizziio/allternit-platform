# Attestation — Fabric Transport: embedded browser + computer agent bar in ACI mode (PR #384)

- **Session:** `ao/fabric-aci-browser-0911` (kimi)
- **Date:** 2026-09-11 20:25 local
- **PR:** https://github.com/Gizziio/allternit-platform/pull/384 — merged as `dc372e2f3`
- **Live:** https://fabrictransport.allternit.com/ — SW cache **v38** (was v37)

## What was done

Corrected-scope follow-up to #375 (Eoj: "the actual browser embedded in ACI mode, and the Allternit computer agent chat bar"), plus the code-mode and chat asks from the same message.

### ACI mode = desktop browser mode
- `FabricAciModeCanvas` now mounts `BrowserPaneWrapper` + `BrowserCapsuleEnhanced` (React.lazy, Suspense, ErrorBoundary) — the real desktop browser-mode view: tabs, address bar, web content, landing page/shortcuts, and the **Allternit Computer Agent** chat pane (`BrowserChatPane` → extension-sidepanel adapter → `BrowserExtensionComposer`).
- **Fabric ACI runner seam** in `browserAgent.store.ts`: module-level `setFabricAciRunner`/`getFabricAciRunner`; `startAciSession`, `stopExecution`, `stopAcuTask` delegate to the registered runner. Required because the capsule's stock run path posts to local `/api/aci/*`, which on the hosted PWA returns SPA HTML (Pages `_redirects` has no `/api` proxy — verified). The canvas registers `{start: onRunGoal, stop: onStopRun}` on mount and clears on unmount (identity-checked). Panel maps start → `fabricClient.startAci` on the paired node (existing openComputer routing: ACI rail + select session + auto-watch) and stop → `fabricClient.abortSession(aciRunId ?? selectedSessionId)`.
- Live frames still flow through the panel's `streamAci` → `ingestAciStreamEvent` into the shared browser-agent store, so the capsule's `showAciViewport` overlay (`ACIComputerUseView`) shows the node's live screen mid-run — same as desktop.
- `useExtensionBridge` no-ops outside Electron (verified at `useExtensionBridge.ts:58`); office bindings are flag-gated; capsule is already mounted by the main web app's ViewRegistry, so web-context runtime is proven.
- Removed the interim goal-composer bar from the canvas (the capsule's agent pane is the composer now); dropped the unused `aciOpening` state.

### Code mode
- New **Sessions** segmented tab (Termius-style terminal sessions) next to Terminal/Chat: renders `FabricCodeDrive` with a `terminalSessionId` override (`fabric-terminals:<runtimeId>`, no workingDir) so `UnifiedTerminal` runs its own runtime-scoped multi-session terminal manager instead of the fabric session's single bound terminal.
- Permission/question/event blocks are suppressed while a full-pane code drive is visible.

### Chat/code message view
- Message bubbles render image parts as well as text (`partImageSrc` exported from `FabricSessionDriveViews`).

### Deferred (stated in the PR)
- Full desktop transcript parity (reasoning/tool parts via `CoworkTranscript`): it reads `useChatSessionStore`, which is coupled to platform backend sync; needs a dedicated adapter, not done here.
- Voice input / GIF capture: desktop-only services (local voice gateway / tools bridge).

## Verification

- `pnpm --filter @allternit/ai typecheck` — clean.
- `vitest run src/components/dispatch src/capsules/browser src/lib/fabric-session-kind.test.ts` — 35/35. New: `FabricAciModeCanvas.test.tsx` (capsule mount via mock, runner register/clear on unmount, agent-bar run → onRunGoal, stop → onStopRun) and 4 fabric-runner delegation tests in `browserAgent.store.test.ts`.
- `vite build --config vite.fabric-session.config.ts` + `prepare-fabric-session-pwa.mjs` from merged main — OK, bundle carries v38.
- Deployed via wrangler (`--commit-hash=dc372e2f3`); live SW **v38** confirmed via curl.
- CI on PR #384: Desktop unit tests, Typecheck and build desktop, gitleaks, validate-typography, check-sw-cache-bump — all pass. (Vercel fleet-wide rate-limited, pre-existing.)

## Notes

- Phone needs hard-refresh / site-data clear to pick up v38.
- Desktop app (b2186) predates this PR; rebuild when the user next asks for a desktop refresh.
