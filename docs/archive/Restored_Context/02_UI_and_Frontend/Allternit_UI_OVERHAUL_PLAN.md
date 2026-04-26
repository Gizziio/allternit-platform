# Allternit Platform UI Overhaul — Master Implementation Plan

**Source:** Live audit + full codebase inspection
**Design System:** Obsidian/Sand palette · Rectilinear geometry · GlassSurface/GlassCard · CSS variables · Lucide + Phosphor icons
**Standard:** Production quality only — no stubs, no placeholders, no comments as substitutes

---

## Design System Reference (for all new components)

### CSS Variables (always use these, never hardcode hex)
```
--bg-primary           Background, main content areas
--bg-secondary         Cards, panels, secondary surfaces
--text-primary         All primary body text
--text-secondary       Labels, descriptions
--text-tertiary        Muted/dimmed text, timestamps
--accent-primary       Brand blue highlights
--accent-chat          Chat mode blue (#007aff)
--border-subtle        Dividers, card edges
--border-default       Interactive borders
```

### Allternit Brand Identity
- **Obsidian** `#1A1612` — primary backgrounds
- **Sand/Gold** `#D4B08C` — brand accent, checkmarks, key actions
- **Off-white** `#ECECEC` — primary text
- **Muted Sand** `#9B9B9B` — secondary text
- **Mode colors:** Chat `#007aff` · Cowork `#af52de` · Code `#34c759`
- **Aesthetic:** Rectilinear, architectural, precise. No organic blobs.

### Component Imports Pattern
```tsx
import { GlassSurface } from '@/design/GlassSurface';
import { GlassCard } from '@/design/GlassCard';
import { Icon } from '@/design/icons/Icon';
// Lucide for common icons
import { Search, Clock, Archive, Activity, Target, Bug } from 'lucide-react';
// Phosphor for stylistic icons (duotone, fill, thin)
import { MagnifyingGlass, Timer, Archive } from '@phosphor-icons/react';
```

### View Template
```tsx
export function SomeView() {
  return (
    <GlassSurface className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[var(--border-subtle)] flex items-center gap-3">
        <IconHere className="w-5 h-5 text-[var(--accent-primary)]" />
        <div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">Title</h2>
          <p className="text-xs text-[var(--text-tertiary)]">Subtitle</p>
        </div>
      </div>
      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* real content */}
      </div>
    </GlassSurface>
  );
}
```

---

## Sprint 1 — Stop All Crashes

**Files changed:** `nav.policy.ts`, `ShellApp.tsx`
**Files created:** 7 new view components

### 1A — nav.policy.ts additions
Add these entries to `DEFAULT_POLICIES`:

| viewType | Policy |
|---------|--------|
| `history` | singleton, surface: view |
| `archived` | singleton, surface: view |
| `insights` | singleton, surface: view |
| `activity` | singleton, surface: view |
| `goals` | singleton, surface: view |
| `new-document` | singleton: false, allowNew: true, surface: view |
| `new-file` | singleton: false, allowNew: true, surface: view |
| `search` | singleton: true, surface: view |
| `debug` | singleton: true, surface: view |

### 1B — New View Components

| File | viewType(s) | Description |
|------|------------|-------------|
| `src/views/HistoryView.tsx` | `history` | Recent sessions list — grouped by Today/Yesterday/This Week/Older, searchable, with session preview, message count, timestamps |
| `src/views/ArchivedView.tsx` | `archived` | Archived sessions with restore capability, same layout as HistoryView |
| `src/views/cowork/InsightsView.tsx` | `insights` | Productivity analytics — activity heatmap, artifact creation stats, session durations |
| `src/views/cowork/ActivityView.tsx` | `activity` | Chronological activity feed — filter by type (docs, runs, chats), date range |
| `src/views/cowork/GoalsView.tsx` | `goals` | Goal management — create/edit goals, progress tracking, completion rate KPIs |
| `src/views/SearchView.tsx` | `search` | Global search — search box, results grouped by type (Files, History, Docs, Code) |
| `src/views/code/DebugView.tsx` | `debug` | Debug console — output viewer, variable state, run status |

### 1C — ShellApp.tsx additions
Wire 9 new viewTypes into the registry map.

---

## Sprint 2 — Replace Placeholder Views

### 2A — MarketplaceView
`src/views/MarketplaceView.tsx` → `marketplace` viewType

**Design:** Card grid of available extensions/models/integrations
- Filter tabs: All · Models · Tools · Integrations · Plugins
- Each card: icon, name, description, version, install button
- "Installed" state with green checkmark
- Search bar
- Category chips

### 2B — SettingsView
`src/views/settings/SettingsView.tsx` → `settings` viewType

**Design:** Two-column settings panel
- Left: navigation list (General, Appearance, Models, API Keys, Shortcuts, About)
- Right: settings form panels per section
- Toggle switches, input fields, dropdowns — all using the design system

---

## Sprint 3 — Fix Dark-on-Dark Theming

Views that render but have invisible text due to hardcoded dark colors on dark backgrounds:

| View | File | Fix |
|------|------|-----|
| Studio / Agent Studio | `AgentView.tsx` | Replace hardcoded dark text colors with `var(--text-primary)` |
| Native Agent | `NativeAgentView.tsx` | Same |
| Multimodal | `MultimodalInput.tsx` | Same |
| Tambo UI Gen | `TamboStudio.tsx` | Same |
| Cloud Deploy | `CloudDeployView.tsx` | Same |
| Elements Lab | `ElementsLab.tsx` | Same |

---

## Sprint 4 — Cowork-Specific Views

Currently all Workstreams + Artifacts items route to the generic `workspace` (CoworkRoot). Each needs its own view + viewType registration.

**New viewTypes needed in nav.policy.ts:**
`cowork-runs`, `cowork-drafts`, `cowork-tasks`, `cowork-documents`, `cowork-tables`, `cowork-files`, `cowork-exports`

**Update cowork.config.ts payloads:**
```
Runs      → cowork-runs
Drafts    → cowork-drafts
Tasks     → cowork-tasks
Documents → cowork-documents
Tables    → cowork-tables
Files     → cowork-files
Exports   → cowork-exports
```

**New Files:**

| File | viewType | Description |
|------|---------|-------------|
| `src/views/cowork/RunsView.tsx` | `cowork-runs` | Pipeline run history — status badges, timing, logs drawer |
| `src/views/cowork/DraftsView.tsx` | `cowork-drafts` | Document drafts — card grid with preview, last edited, status |
| `src/views/cowork/TasksView.tsx` | `cowork-tasks` | Kanban or list task board — status columns, assignee, due date |
| `src/views/cowork/DocumentsView.tsx` | `cowork-documents` | Document browser — list/grid toggle, search, type filter |
| `src/views/cowork/TablesView.tsx` | `cowork-tables` | Data table browser — preview rows, row count, last updated |
| `src/views/cowork/FilesView.tsx` | `cowork-files` | File manager — folder tree, breadcrumb nav, file cards |
| `src/views/cowork/ExportsView.tsx` | `cowork-exports` | Export history — format, size, download link, status |

---

## Sprint 5 — Code Mode Fix + Sub-views

### 5A — Fix `size is not defined` crash
Investigate `CodeCanvas.tsx` → `PatchGate.tsx` → `ChangeSetReview.tsx` component tree for the unbound `size` variable. Fix at source.

### 5B — Code mode sub-views
Currently Workspace/Threads/Explorer/Git Graph/Automations/Skills all route to the same `code` viewType (CodeRoot). Need new viewTypes:

**Update code.config.ts payloads:**
```
Explorer    → code-explorer
Git Graph   → code-git
Threads     → code-threads
Automations → code-automations
Skills      → code-skills
Search      → search (already planned in Sprint 1)
```

**New Files:**

| File | viewType | Description |
|------|---------|-------------|
| `src/views/code/ExplorerView.tsx` | `code-explorer` | File tree browser — folder expand/collapse, file icons by type, search |
| `src/views/code/GitView.tsx` | `code-git` | Git graph — branch visualization, recent commits, diff preview |
| `src/views/code/ThreadsView.tsx` | `code-threads` | Code conversation threads — linked to file context |
| `src/views/code/AutomationsView.tsx` | `code-automations` | Automation rules — trigger/action pairs, enable/disable |

---

## Execution Order

1. **Sprint 1** — Immediate. Stops all crashes. 9 policies + 7 views + wire-up.
2. **Sprint 2** — High value. Replaces the most visible stubs.
3. **Sprint 3** — Quick wins. Fixes theming across 6 views (CSS var swaps).
4. **Sprint 4** — Cowork build-out. 7 new dedicated views.
5. **Sprint 5** — Code mode. Fix crash first, then sub-views.

---

## File Change Summary

| Sprint | Files Modified | Files Created |
|--------|---------------|---------------|
| 1 | 2 (`nav.policy.ts`, `ShellApp.tsx`) | 7 |
| 2 | 0 | 2 |
| 3 | 6 (theme fixes) | 0 |
| 4 | 3 (`nav.policy.ts`, `ShellApp.tsx`, `cowork.config.ts`) | 7 |
| 5 | 3 (`nav.policy.ts`, `ShellApp.tsx`, `code.config.ts`) | 4+ |
| **Total** | **14** | **20+** |

---

*Proceed Sprint 1 → Sprint 2 → Sprint 3 → Sprint 4 → Sprint 5*
