---
status: done
files_changed: []
deviations: []
remaining: []
---

# ACI/Browser + Design/Creative Triage — Phase 1

Re-investigation of `docs/SURFACE_AUDIT_SESSION_PROGRESS.md` rows 39–59 against the live codebase. Read-only — no source files were modified. Evidence cites `surfaces/ai.allternit.com/src/views/` (web), `surfaces/allternit-mobile/ios/Features/` (iOS), and `cmd/gizzi-code/src/` (gizzi-code).

**Headline finding:** iOS's `AppMode.swift` documents an explicit, deliberate product decision to skip the entire Design mode on iOS ("`design` is skipped on iOS — on the web it opens an external window", `surfaces/allternit-mobile/ios/Core/AppMode.swift:6-8`). This is not an oversight — it reclassifies most of the Design Mode tab items (47–52, 53, 57) from "accidental gap" to "documented, intentional scope exclusion," i.e. `DEFER` rather than `REAL`.

---

## ACI/Browser (rows 39–46)

### 1. ACI Browser surface (GAP → gizzi-code) — `DEFER`

Fully implemented on web (`surfaces/ai.allternit.com/src/views/browser/BrowserSessionStore.ts`, `views/aci/*`, `views/OperatorBrowserView.tsx`) and on iOS (`Features/ACI/Views/ACITabView.swift`, `ACIWebBrowserView.swift` — a full `WKWebView`-backed in-app browser with URL bar, back/forward, agent toggle). `cmd/gizzi-code/src` has zero browser/webview UI of any kind — it's a terminal CLI tool with no GUI surface at all. The gap is real, but embedding a graphical browser inside a text-mode CLI is a large architectural undertaking, not a straightforward port.

**Next action:** Defer to a dedicated gizzi-code GUI/webview initiative, if ever pursued.

### 2. Mini-apps Store (GAP → iOS) — `REAL`

Web has a full implementation: `views/aci/AciMiniAppsView.tsx`, `MiniAppDetailView.tsx`, `mini-app-registry.ts`, `use-mini-app-catalog.ts`, `use-mini-app-discovery.ts`. iOS: zero matches for "mini-app"/"miniapp" anywhere under `Features/`; `ACITabView.swift`'s landing page has no store entry point, only a URL bar, agent toggle, and 3 hardcoded shortcuts.

**Next action:** Confirmed live gap — candidate for a future iOS build phase.

### 3. Mini-app frame/runtime (GAP → iOS) — `REAL`

Web implements a sandboxed mini-app runtime: `AciMiniAppFrameView.tsx`, `MiniAppRuntimeSurface.tsx`, `mini-app-harness.ts`, plus signing (`mini-app-signing.ts`) and a permission model (`mini-app-permissions-explain.ts`). iOS's `ACIWebBrowserView.swift` is a plain, unrestricted browser — not a sandboxed third-party mini-app host. No iOS equivalent exists.

**Next action:** Confirmed live gap; depends on #2 (store) as its entry point.

### 4–6. Office Add-ins — Word / Excel / PowerPoint (GAP → iOS, gizzi-code) — `DEFER` (all three)

Web implements **all three hosts through one parametrized component**, `views/aci/AciAddinView.tsx` (`type OfficeHost = 'word' | 'excel' | 'powerpoint'`, lines 33-72), backed by a real add-in package at `surfaces/allternit-extensions/allternit-office-addin`. Neither iOS nor gizzi-code has any matching code (0 grep hits for `office|excel|powerpoint|word add-in` in either tree). Office Add-ins are Office.js task panes that execute *inside* Word/Excel/PowerPoint host applications — not something a native iOS chat app or a terminal CLI can host directly. At most, a companion "add-in install/health status" view could be built (similar in spirit to the shipped iOS Device Pairing panel, PR #5), but that is a single shared surface, not three separate builds — the three rows track one underlying gap.

**Next action:** Defer. If pursued, scope as one "Office Add-ins management" companion view, not three.

### 7. Office & Extensions view (GAP → iOS, gizzi-code) — `DEFER`

Web's `views/AppsExtensionsView.tsx` (652 lines) is a full marketplace-style hub aggregating browser extensions, the three Office Add-ins, and mini-apps. No iOS or gizzi-code equivalent hub exists. Real gap, but it bundles items 40–45, all of which are themselves deferred or dependent on deferred work — defer together.

**Next action:** Defer; revisit once #40/#41 (Mini-apps) ship and #42–44 (Office Add-ins) are scoped.

### 8. Operator Browser (GAP → gizzi-code) — `DEFER`

Web implements `views/OperatorBrowserView.tsx`, `components/AllternitOperatorStatus.tsx`, `lib/services/useAllternitOperatorStatus.ts` (computer-use operator browsing). iOS already has a documented parity implementation — `BrowserChatView.swift` explicitly states "web parity: OperatorBrowserView's BrowserChatPanel" (line 3) and is wired through `ACIAgentRunView.swift`/`ACITabView.swift`. gizzi-code has none, for the same reason as #39 — it's a CLI tool with no GUI surface to host an operator browsing view.

**Next action:** Defer to the same future gizzi-code GUI initiative as #39.

---

## Design/Creative (rows 47–59)

### 9. Design Mode — Questions tab (GAP → iOS, gizzi-code) — `DEFER`

Web: fully implemented as the `questions` tab in `views/design/DesignModeView.tsx` (default tab, `DesignModeView.tsx:299`). iOS: no Design feature folder exists under `Features/` at all, and `Core/AppMode.swift:6-8` explicitly documents that Design mode is skipped on iOS by design ("opens an external window" on web instead). gizzi-code: no matching code (CLI has no GUI). This is a deliberate, documented scope exclusion, not an accidental gap.

**Next action:** Defer — respects the existing documented iOS scope decision.

### 10. Design Mode — Mobile tab (GAP → iOS, gizzi-code) — `DEFER`

Web: `views/design/mobile/MobilePreviewView.tsx`, wired as the `mobile` tab in `DesignModeView.tsx`. Same "design skipped on iOS" exclusion applies (`AppMode.swift:6-8`). No gizzi-code equivalent.

**Next action:** Defer, same as #9.

### 11. Design Mode — Docs tab (GAP → iOS, gizzi-code) — `DEFER`

Web: `docs` tab in `DesignModeView.tsx` (line 666+), using `views/design/office/UniverDocEditor.tsx`. Same design-mode-skipped-on-iOS exclusion. No gizzi-code equivalent.

**Next action:** Defer, same as #9.

### 12. Design Mode — Handoff tab (GAP → iOS, gizzi-code) — `DEFER`

Web: `views/design/DesignHandoffView.tsx`, wired as `handoff` tab (`DesignModeView.tsx:647-650`). Same exclusion applies. No gizzi-code equivalent.

**Next action:** Defer, same as #9.

### 13. Design Mode — Graph tab (GAP → iOS, gizzi-code) — `DEFER`

Web: `views/design/graph/ContentSkillGraphView.tsx`, wired as `graph` tab (only shown for content-type projects, `DesignModeView.tsx:133,443`). Same exclusion applies. No gizzi-code equivalent.

**Next action:** Defer, same as #9.

### 14. Design Mode — Pipeline tab (GAP → iOS, gizzi-code) — `DEFER`

Web: `views/design/ContentPipelineView.tsx`, wired as `pipeline` tab (`DesignModeView.tsx:134,444`). Same exclusion applies. **Note:** this is the exact same component as row 58 "Content Pipeline" below — see that entry for the duplicate-row finding.

**Next action:** Defer, same as #9.

### 15. Design Marketplace/Registry (GAP → iOS) — `DEFER`

Web: `views/design/DesignRegistryView.tsx`, reachable both as the `market` tab inside `DesignModeView.tsx` and via the standalone route `design-view-market` (`shell/ViewRegistry.tsx:382-386`). Since it's routed both as a Design Mode tab and directly, the "design skipped on iOS" decision covers its primary entry point; no independent iOS implementation exists.

**Next action:** Defer, consistent with the Design Mode exclusion.

### 16. Design Compare (GAP → iOS, gizzi-code) — `STALE`

The premise that web has a distinct "Compare" feature to port is wrong. In `shell/ViewRegistry.tsx:387-391`, the `design-view-compare` route renders `<DesignRegistryView />` — **the identical component used for the marketplace route** (lines 382-386, 392-396). There is no dedicated compare UI anywhere in the codebase (no diff/side-by-side component under `views/design/`). This is a stub route aliased to an existing view, not a missing surface with real content behind it.

**Next action:** Close as stale. If a real design-compare feature is wanted, it needs to be built on web first — it doesn't exist to be "missing" on iOS/gizzi-code.

### 17. Form Surfaces (GAP → iOS, gizzi-code) — `REAL`

Web: `views/FormSurfacesView.tsx` (441 lines) — dynamic schema-based form rendering for agent communication (text/number/select/textarea/toggle/slider/multiselect/radio field types). Unlike the Design Mode items above, this is registered as an independent, standalone singleton view in `nav/nav.policy.ts:92` (`'form-surfaces': { singleton: true, ... }`), **not** gated behind the Design-mode-skipped-on-iOS decision — it has its own top-level route. No iOS or gizzi-code implementation exists.

**Next action:** Confirmed live gap for iOS. A gizzi-code (terminal/ink TUI) equivalent would need separate design work given the field-type richness (sliders, multiselect) — treat as a stretch target, not blocking the iOS build.

### 18. Canvas Protocol (PARTIAL → iOS) — `REAL`

The Rust crate `platform/protocols/canvas-protocol/src/lib.rs` defines "40+ canonical view types" (`CanvasViewType` enum) and a full Canvas Runtime/State Manager. iOS's `Core/API/CanvasClient.swift` (106 lines) implements only `listCanvases`, `createArtifactCanvas`, `updateArtifactCanvas` — a thin client scoped to artifact canvases only, none of the other ~39 canonical view types. This is a genuine, independent gap (not covered by the Design-mode exclusion — `CanvasClient` is used by `ACIAgentRunView.swift` and `ArtifactLibraryStore.swift`, both outside Design mode).

**Next action:** Confirmed partial; scope which of the 40 canonical view types iOS actually needs before building out `CanvasClient`.

### 19. Design Team Workspace (GAP → iOS, gizzi-code) — `DEFER`

Web: `views/design/DesignTeamWorkspace.tsx`, wired as the `team` tab in `DesignModeView.tsx:447`. Covered by the same "design skipped on iOS" decision as #9–14.

**Next action:** Defer, same as #9.

### 20. Content Pipeline (GAP → iOS, gizzi-code) — `STALE`

This is a duplicate row of #14 "Design Mode — Pipeline tab." Both point at the exact same component: `views/design/ContentPipelineView.tsx`, lazily imported once (`DesignModeView.tsx:67`) and wired to the single `pipeline` tab. There are not two separate features here — the audit split one implementation into two tracker rows.

**Next action:** Close as stale/duplicate; track any future work under #14 only.

### 21. Live Artifact Editor (PARTIAL → upgrade) — `DEFER`

`views/design/LiveArtifactEditor.tsx` exists and works on web today — template + JSON-data live rendering via `renderLiveArtifact`/`parseLiveArtifactData` (`lib/design/live-artifact.ts`). The "partial" gap is real but is a web-side limitation, not a missing-platform gap: persistence is client-only `localStorage` (`STORAGE_KEY = 'allternit-design-live-artifacts'`, `LiveArtifactEditor.tsx:31-38`), with no backend/cross-device sync. iOS's `ArtifactsLibraryView.swift` has no live-artifact templating equivalent at all, but the tracked target here is "upgrade" (improve the existing web feature), not a named platform port — that puts it outside this phase's scope, which is specifically verifying iOS/gizzi-code platform-parity gaps.

**Next action:** Defer to a dedicated "Artifacts backend persistence" phase; out of scope for ACI/Browser + Design/Creative platform-gap triage.

---

## Summary table

| # | Item | Classification |
|---|------|----------------|
| 39 | ACI Browser surface | DEFER |
| 40 | Mini-apps Store | REAL |
| 41 | Mini-app frame/runtime | REAL |
| 42 | Office Add-ins — Word | DEFER |
| 43 | Office Add-ins — Excel | DEFER |
| 44 | Office Add-ins — PowerPoint | DEFER |
| 45 | Office & Extensions view | DEFER |
| 46 | Operator Browser | DEFER |
| 47 | Design Mode — Questions tab | DEFER |
| 48 | Design Mode — Mobile tab | DEFER |
| 49 | Design Mode — Docs tab | DEFER |
| 50 | Design Mode — Handoff tab | DEFER |
| 51 | Design Mode — Graph tab | DEFER |
| 52 | Design Mode — Pipeline tab | DEFER |
| 53 | Design Marketplace/Registry | DEFER |
| 54 | Design Compare | STALE |
| 55 | Form Surfaces | REAL |
| 56 | Canvas Protocol | REAL |
| 57 | Design Team Workspace | DEFER |
| 58 | Content Pipeline | STALE (duplicate of #52) |
| 59 | Live Artifact Editor | DEFER |

**Real, buildable gaps from this phase: #40 (Mini-apps Store), #41 (Mini-app frame/runtime), #55 (Form Surfaces), #56 (Canvas Protocol).** Everything else is either an intentional, documented scope exclusion (Design Mode on iOS), a CLI/GUI architectural mismatch (gizzi-code browser/office items), a stale/duplicate tracker row (#54, #58), or genuinely out of this phase's platform-parity scope (#59).
