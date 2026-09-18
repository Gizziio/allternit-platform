# Gap Analysis: Nyx-Inspired Canvas + h5i Integration

**Session Date:** 2026-04-24  
**Scope:** Phases 1–4 (Canvas) + h5i Tiers 1–3 + Entire-inspired improvements  
**Grader:** Self-assessment by Kimi Code CLI

---

## 1. Canvas Code Mode (Phases 1–4)

### What Was Built

| Component | Grade | Notes |
|-----------|-------|-------|
| Infinite canvas pan/zoom | **B+** | CSS transforms work well. No inertia/momentum panning. Zoom is discrete (Ctrl+wheel) rather than smooth. |
| Canvas tiles (draggable, resizable) | **B+** | 8px snap on release works. No snap guides during drag. Resize handle is tiny (6px). No collision detection between tiles. |
| Tile spawn animations | **B** | CSS keyframe works but plays on every re-render, not just first mount. Should use a "mounted" ref to play once. |
| Session tiles | **A-** | Reuses StreamingChatComposer correctly. CompactChatComposer fits well. Brain icon for context trace is a nice touch. |
| Preview tiles | **B** | Simple iframe + URL bar. No sandbox CSP injection like CodePreviewProgram. No console forwarding. |
| Diff tiles | **B+** | Unified diff parser handles standard format. No syntax highlighting. No hunk navigation. |
| Terminal tiles | **B** | xterm.js loads dynamically. Local echo only — no real PTY backend wired. FitAddon works on resize. |
| Notes tiles | **A-** | Simple textarea. No markdown rendering. No persistence (content lost on tile close). |
| Knowledge tiles | **B+** | Claims + summaries tabs work. Polling every 30s is reasonable. No ability to add/edit claims from UI. |
| Focus mode | **B+** | Fullscreen single tile works. No animated transition. Escape key exits. |
| Minimap | **B** | Shows tiles and viewport. Click-to-pan works. No real-time tile updates during drag (only on state change). |
| Toolbar | **A-** | Clean layout. All 6 tile types + h5i features accessible. Could use tooltips. |
| Context menu | **B+** | Right-click spawn works. "Open Existing Session" submenu is useful. No keyboard navigation. |
| Keyboard shortcuts | **B** | Arrows pan, Ctrl+/- zoom, Ctrl+0 reset, Esc exit focus. No shortcuts for spawn tile types. No help overlay. |
| Touch support | **C+** | Pinch zoom implemented but not thoroughly tested. Single touch pan relies on pointer events (should work). No touch-specific UI. |
| Auto-arrange | **B** | Grid layout works. No awareness of tile content type (e.g., terminal tiles could be shorter). |
| HUD | **A-** | Simple session count. Could show more: zoom level, tile count, active session name. |

### Canvas Missing / Incomplete

| Gap | Severity | Fix Effort |
|-----|----------|------------|
| No tile collision detection / overlap prevention | Medium | 2–3 days |
| Tile spawn animation plays on re-render | Low | 2 hours |
| No tile tabs (grouping multiple sessions in one tile) | Medium | 2–3 days |
| No session-to-session linking (output → input) | High | 1 week |
| No undo/redo for canvas operations | Medium | 2–3 days |
| No canvas save/load (export layout) | Low | 1 day |
| No search/filter tiles | Low | 1 day |
| Preview tile lacks CSP sandbox | Medium | 1 day |
| Terminal tile has no real PTY | High | 3–5 days |
| Notes tile content not persisted | Low | 2 hours |
| No touch-specific UI (e.g., pinch indicators) | Low | 1 day |

**Overall Canvas Grade: B+**

Solid foundation. All core interactions work. Missing polish features that would make it feel truly native (Nyx-level). The biggest gap is no real PTY in terminal tiles and no session linking.

---

## 2. h5i Integration (Tiers 1–3 + Borrowed Features)

### What Was Built

| Component | Grade | Notes |
|-----------|-------|-------|
| `files_touched` polling | **B** | Polls git status every 15s. No push-based updates. Doesn't track which session touched which file (workspace-level only). |
| h5i vibe audit | **B+** | Panel works. Parses output heuristically. Auto-init is convenient. Raw output toggle is useful. |
| Context trace viewer | **B+** | Color-coded OBSERVE/THINK/ACT/NOTE. Polls every 5s. No filtering by type. No search. |
| Context auto-start/finish | **B** | useH5iContext hook works. Best-effort — failures are silent. No retry logic. |
| Knowledge tiles | **B** | Claims + summaries displayed. No ability to create claims from UI. Summary text is empty (needs `h5i summary show`). |
| Dashboard preview | **A-** | Simple iframe to localhost:7150. Works if h5i serve is running. No auto-start. |
| Reasoning diff | **B** | Session selector + diff output. Color-coded by side. No inline diff (just list view). |
| Commit provenance | **B+** | Form + API route works. Hash extraction from output is brittle (regex). |
| Agent hooks installer | **B** | Creates .md files in agent directories. Not true hooks — just documentation. Doesn't modify agent config files (e.g., `.claude/settings.json`). |
| Secret redaction | **B+** | 11 regex patterns cover common cases. Best-effort. No entropy-based detection. |
| Auto-summarization | **C+** | Heuristic summary from ACT/THINK entries. Not using LLM. Very basic. Stores as h5i note. |
| MCP config | **B+** | Config endpoint + UI panel. Copy-to-clipboard works. Doesn't auto-start MCP server. |

### h5i Missing / Incomplete

| Gap | Severity | Fix Effort |
|-----|----------|------------|
| Agent hooks are docs, not real hooks | **High** | 3–5 days |
| Auto-summarization doesn't use LLM | **Medium** | 1–2 days |
| Knowledge tile can't create/edit claims | **Medium** | 2–3 days |
| No push-based files_touched (only polling) | **Low** | 1–2 days |
| h5i dashboard doesn't auto-start | **Low** | 2 hours |
| MCP server doesn't auto-start | **Low** | 2 hours |
| Commit hash extraction is brittle | **Low** | 1 hour |
| No h5i `notes review` integration | **Low** | 1 day |
| No h5i `compliance` integration | **Low** | 1 day |
| Context trace has no filtering/search | **Low** | 1 day |
| No checkpoint/rewind UI | **Medium** | 2–3 days |

**Overall h5i Grade: B**

Good coverage of Tiers 1–3. The biggest gap is that agent hooks are documentation files, not actual executable hooks. This means agents won't automatically capture context — users must manually run h5i commands. True integration requires modifying agent config files (like `.claude/settings.json` hooks or Codex's hooks.json).

---

## 3. Code Quality & Architecture

| Aspect | Grade | Notes |
|--------|-------|-------|
| TypeScript types | **B+** | Types added to CodeModeStore. Some `any` inferred in tile content. Service types are explicit. |
| Error handling | **B** | API routes catch errors. Frontend shows error states. Silent failures in hooks (intentional but could log). |
| API route consistency | **B+** | All h5i routes use POST with JSON body. Consistent error format. |
| State management | **B+** | Canvas state in CodeModeStore is clean. No competing stores. Persistence works. |
| Component composition | **A-** | TileContent switch is extensible. Components are focused. |
| CSS/styling | **B** | Inline styles throughout. No CSS modules or Tailwind classes. Works but not scalable. |
| Accessibility | **C** | No ARIA labels. No keyboard navigation in context menu. Focus management minimal. |
| Performance | **B** | No virtualization for many tiles. Polling intervals are reasonable. No memoization issues. |

### Quality Gaps

| Gap | Severity | Fix Effort |
|-----|----------|------------|
| Inline styles everywhere | Medium | 3–5 days (migrate to CSS modules or Tailwind) |
| No ARIA/accessibility | High | 2–3 days |
| No unit tests | High | 1 week |
| No E2E tests | High | 1 week |
| No virtualization for 10+ tiles | Medium | 2–3 days |

---

## 4. Build & Deployment

| Aspect | Grade | Notes |
|--------|-------|-------|
| Build passes | **A** | Fixed 10 pre-existing issues. Canvas + h5i code compiles cleanly. |
| Pre-existing fixes | **A-** | Fixed unrelated files to get build passing. These should be committed separately. |
| No breaking changes | **A** | CodeThreadView preserves existing experience. All changes are additive. |
| Environment detection | **B** | h5i availability checked at runtime. Graceful degradation. |

---

## 5. Overall Session Grade

| Category | Grade | Weight | Weighted |
|----------|-------|--------|----------|
| Canvas Foundation | B+ | 30% | 2.55 |
| h5i Integration | B | 25% | 2.13 |
| Code Quality | B | 20% | 1.70 |
| Build/Deploy | A- | 15% | 1.28 |
| Completeness vs Spec | B+ | 10% | 0.85 |
| **Total** | | | **8.51 / 10 = B+** |

---

## 6. Top 5 Priority Fixes

1. **Agent hooks → real config files** (High, 3–5 days)
   - Modify `.claude/settings.json`, `.codex/hooks.json`, etc. to actually call h5i commands
   
2. **Auto-summarization → LLM-based** (Medium, 1–2 days)
   - Call gizzi-code chat API with the trace text
   
3. **Tile spawn animation fix** (Low, 2 hours)
   - Use a mounted ref so animation plays once, not on re-render
   
4. **Accessibility pass** (High, 2–3 days)
   - ARIA labels, keyboard navigation, focus trapping in modals
   
5. **Terminal tile → real PTY** (High, 3–5 days)
   - Wire to existing `UnifiedTerminal` or VM session executor

---

## 7. What Was Excellent

- **No breaking changes** — Existing thread experience is fully preserved
- **Modular tile system** — Adding new tile types is trivial (add to switch + type union)
- **Graceful degradation** — h5i features work when available, silently disable when not
- **Build discipline** — Fixed pre-existing issues rather than leaving them broken
- **Research depth** — h5i vs Entire analysis was thorough and actionable

## 8. What Needs Work

- **Agent hooks are cosmetic** — Biggest functional gap
- **Auto-summarization is heuristic** — Not using the LLM backend
- **No tests** — Zero unit, integration, or E2E tests for new code
- **Inline styles** — Will become unmaintainable at scale
- **Touch support is theoretical** — Not tested on actual touch devices
