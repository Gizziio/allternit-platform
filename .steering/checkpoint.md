# Session checkpoint — suite-assistant-fix

**Goal:** Fix two verified bugs in the Allternit Desktop office suite AI assistant: (1) doubled provider prefix in `runtimeModelId` (`kimi-cli/kimi-cli/kimi-for-coding`) causing 400s on `/api/agent-chat`; (2) assistant chat panel missing active document context despite an open autosaved document.

**Just did:**
- Live-confirmed both bugs via CDP 9224: localStorage `allternit:model-selection` has `modelId: "kimi-cli/kimi-for-coding"` (prefixed), and the Assistant banner reads "Allternit Docs — no document open" on /docs with Untitled.docx open.
- Bug 1 fixed at four layers: `office-ai/src/model-selection.ts` (`resolvePlatformModelId` strips a baked-in provider prefix; fixes already-corrupted storage), platform `components/model-picker.tsx` (3 handlers persist short modelId), `lib/default-brain.ts` (`normalizePersistedModelSelection` on read + re-persist), `lib/agents/mode-session-store.ts` (`resolveRuntimeModelId` guard).
- Bug 2 fixed: `activeDocument.ts` is now a two-layer registry (`reportActiveDocument` app-reported wins over `registerActiveDocument` prop name; lazy content getter; stable snapshots for useSyncExternalStore). Vendored docs app (`office-docs-app/src/renderer/App.tsx`) reports real `doc.fileName` + live editor text. Assistant panel `buildAssistantContext` emits title + bounded excerpt (4000 chars). Also fixed stale-`blocks` closure in the vendored `AiPanel`.
- Tests: office-ai 6/6 (vitest added), office-suite 13/13 (vitest added: registry 8 + context builder 5), ai.allternit.com default-brain 19/19 incl. 2 new regression tests. Typecheck clean: office-ai, office-suite, office-docs-app, ai.allternit.com.

**Next:** full ai.allternit.com suite (background), live re-run feasibility (needs repackage via session/desktop-package — assess), commit + push + PR.

**Open questions:**
- Live verification requires rebuilding the platform static export into the desktop bundle; the running app serves yesterday's build. If packaging is slow, defer with exact steps documented in the PR + ledger.
