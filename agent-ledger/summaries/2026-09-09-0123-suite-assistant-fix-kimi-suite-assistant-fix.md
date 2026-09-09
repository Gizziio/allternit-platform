# Session attestation — suite-assistant-fix

- **Date:** 2026-09-09 ~01:23 local
- **Agent family:** kimi (Kimi Code subagent)
- **Session:** `session/suite-assistant-fix`
- **PR:** #188 — `fix(office-suite): assistant model id double-prefix and missing document context`
- **Merge SHA:** `0a2d1a993e891acd696bd923fb2ac24ddda9692b` (merge commit on main; fix commit `0a335995a`)

## What was done

Fixed two CDP-verified bugs in the Allternit Desktop office suite's AI assistant, live-reproduced on the packaged app (`Allternit-Desktop-fresh.app`, CDP :9224, doc open + autosaved, banner "no document open", every chat 400).

### Bug 1 — doubled provider prefix → every /api/agent-chat request 400

Both the "✦ Allternit Assistant" tab and the "Built-in" tab sent `runtimeModelId: "kimi-cli/kimi-cli/kimi-for-coding"`; gizzi rejected with `ProviderModelNotFoundError {"providerID":"kimi-cli","modelID":"kimi-cli/kimi-for-coding"}`.

- **Write-side root cause:** `surfaces/ai.allternit.com/src/components/model-picker.tsx` (`handleSelectModel`) persisted the catalog model id verbatim; the platform catalog normalizes ids to full `provider/model` runtime ids (`use-available-brain-models.ts`), so `allternit:model-selection` held `modelId: "kimi-cli/kimi-for-coding"` (confirmed in the live app's localStorage).
- **Compose-side root cause:** `packages/@allternit/office-ai/src/model-selection.ts` (`resolvePlatformModelId`) composed `${providerId}/${modelId}` unconditionally.
- **Fix:** `stripProviderPrefix` in office-ai (repairs already-corrupted storage in the field); all three model-picker select paths persist the short id; `normalizePersistedModelSelection` in `lib/default-brain.ts` repairs on read and re-persists; same guard in `lib/agents/mode-session-store.ts` (`resolveRuntimeModelId`, ACI path).

### Bug 2 — "No document is currently open" despite a live autosaved document

- **Root cause:** the active-document registry was fed only by the suite adapters (`DocsApp.tsx` registers `props.document?.name`), but platform `DocsView` passes `document=undefined` for in-app-created documents; the vendored docs app creates/autosaves "Untitled.docx" internally where the registry never saw it. Separately, the vendored `AiPanel` `buildContext` closed over the mount-time `blocks` prop (stale content).
- **Fix:** `extensions/activeDocument.ts` is now a two-layer registry — `reportActiveDocument` (vendored app, authoritative, lazy live-content getter) over `registerActiveDocument` (prop name; no longer wipes an app-reported doc); vendored `office-docs-app/src/renderer/App.tsx` reports `doc.fileName` + live editor text (updates on autosave rename); `AllternitAssistantPanel.buildAssistantContext` emits title + bounded 4000-char excerpt at run time; `AiPanel` reads `blocks` through a ref.

## Verification evidence

- **Unit tests (new):** office-ai `model-selection.test.ts` 6/6 (vitest harness added to the package); office-suite `activeDocument.test.ts` 8/8 + `AllternitAssistantPanel.test.ts` 5/5 (vitest harness added); platform `default-brain.test.ts` +2 (19/19).
- **Typecheck clean:** office-ai, allternit-office-suite, office-docs-app, ai.allternit.com.
- **Full platform suite:** 1441/1442. The one failure (`src/lib/fabric-session-kind.test.ts`, bot→cowork mapping) is **pre-existing on unmodified main** — confirmed by running it in the shared checkout.
- **Live (packaged desktop app, CDP :9224):** rebuilt the platform static export from this branch with the desktop packaging env, rsynced it into `Allternit-Desktop-fresh.app/Contents/Resources/platform/`, reloaded the renderer with HTTP cache disabled (first reload served a stale cached index — cache bypass was required). After the fix:
  - Assistant tab request payload: `runtimeModelId: "kimi-cli/kimi-for-coding"` (was doubled) and message carries `The user currently has "Untitled.docx" open in Allternit Docs.` + `Current document content:` + the live typed text; assistant streamed a correct summary (previously instant 400).
  - Built-in tab: same correct model id, live post-mount content in context, correct streamed reply.
  - Banner: `📄 Untitled.docx` (was "Allternit Docs — no document open").

## Incidents / honest deferrals

- **Pre-existing CI failures not caused by this change:** `Lint and build docs` (competitor-mention lint on `surfaces/docs/cli/native-sessions.mdx`, from an earlier session) and `Cloudflare Pages` (fails on main HEAD `e3b7eabd5` as well). All checks covering the touched code passed: Typecheck, Desktop unit tests, CI smoke, Typecheck-and-build-desktop.
- **Hot-swapped verification bundle:** the running app's `Resources/platform` was replaced with a branch build for live proof (old `index.html` backed up at `/tmp/platform-index-backup.html` during the session, removed at cleanup). A canonical repackage via `surfaces/allternit-desktop` (`prepare:platform-static`) embeds the same merged code; the desktop-package session's worktree was not modified.
- Rebase mid-flight: main moved under the PR (checkpoint.md conflict only); rebased, re-ran tests on the new base before merge.
- The vendored sheets/slides/pdf apps still rely on the suite adapter's prop-name registration (unchanged behavior); only the docs app reports directly. Extending `reportActiveDocument` to the other three vendored renderers is a follow-up if those views gain in-app-created documents.
