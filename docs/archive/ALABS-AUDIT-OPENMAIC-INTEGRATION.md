# A://Labs Production Audit & OpenMAIC Integration Analysis

**Date:** 2026-05-09  
**Auditor:** Kimi Code CLI  
**Scope:** A://Labs view (`surfaces/ai.allternit.com/src/views/LabsView.tsx` + subviews), OpenMAIC.io integration strategy, OpenNotebook fork prominence, Articles/Courses pipeline, DESIGN.md compliance  
**Grade:** C+ (see breakdown below)

---

## 1. Executive Summary

A://Labs is a **shell-managed SPA view** (not a Next.js route) comprising 6 tabs: Discovery, Research, Tracks, Certifications, Agent Elements, and Settings. It attempts to be a learning portal but suffers from:

- **Hardcoded data** everywhere (courses, demos, articles)
- **No CMS or authoring pipeline** for articles
- **Courses that delegate externally** to Canvas LMS instead of rendering natively
- **An OpenNotebook fork that is buried** inside the Research tab rather than being a first-class citizen
- **A visual system that is 70% inline styles** and inconsistent with the global design token architecture
- **No integration with modern multi-agent classroom technology** like OpenMAIC

**The opportunity:** OpenMAIC (Tsinghua's open-source Multi-Agent Interactive Classroom) is a **Next.js + React + Tailwind + LangGraph** project that generates immersive AI lessons with slides, quizzes, simulations, whiteboards, and TTS. It aligns technically and philosophically with Allternit. Integrating it as a native lesson renderer — alongside elevating OpenNotebook to a top-level tab — would transform A://Labs from a course linker into a first-class learning platform.

---

## 2. OpenMAIC.io Analysis

### 2.1 What It Is

| Attribute | Detail |
|-----------|--------|
| **Origin** | THU-MAIC team, Tsinghua University |
| **License** | AGPL-3.0 (commercial licensing available) |
| **Stack** | Next.js 15, React 18, TypeScript, Tailwind CSS |
| **Orchestration** | LangGraph multi-agent state machine |
| **Pipeline** | Two-stage: Outline → Scene generation |
| **Actions** | 28+ action types (speech, whiteboard, spotlight, laser pointer) |
| **Export** | Editable PPTX, interactive HTML |
| **Validation** | 700+ students over 2+ years |
| **Research** | Published in JCST 2026 |

### 2.2 Core Capabilities Relevant to Allternit

1. **One-click lesson generation** from any topic or uploaded document
2. **Multi-agent classroom** — AI teacher, teaching assistant, classmates with distinct personas
3. **Rich scene types:**
   - Intelligent slide lectures with TTS voice narration
   - Interactive quizzes with AI grading
   - Interactive HTML simulations (physics, algorithms, flowcharts)
   - Project-Based Learning (PBL) with milestones
   - Collaborative whiteboard with real-time drawing
4. **Voice interaction** — TTS narration + ASR student input
5. **Engagement modes:** Classroom Discussion, Roundtable Debate, Q&A
6. **Integration:** OpenClaw for Feishu/Slack/Discord/Telegram
7. **LLM support:** OpenAI, Anthropic, Gemini, DeepSeek, OpenAI-compatible APIs

### 2.3 Integration Vectors

| Vector | Approach | Effort |
|--------|----------|--------|
| **A. Fork + Skin** | Fork OpenMAIC, apply Allternit design tokens, embed as `alabs-classroom` view | Medium |
| **B. API Bridge** | Run OpenMAIC as a service, call its generation API from Allternit, render scenes in React | High |
| **C. Component Harvest** | Extract scene renderers (slides, quiz, whiteboard, sim) as reusable React components | Medium |
| **D. Content Pipeline** | Use OpenMAIC's generation pipeline to produce `alabs-generated-courses` HTML modules | Low (immediate) |

**Recommendation:** Start with **D** (immediate content value) + **C** (component extraction for native rendering), then evolve to **A** (full fork integration) once the component library is stable.

---

## 3. A://Labs Section-by-Section Audit

### 3.1 Discovery Tab (`views/discovery/DiscoveryFeed.tsx`)

**Visual Grade: C+**

| Aspect | Assessment |
|--------|------------|
| **Hero Carousel** | Functional but brittle. RAF-based progress bar, keyboard nav, auto-rotation every 8s. Generative cover fallback is nice. |
| **Data Pipeline** | 4-tier fallback (API → static JSON → remote JSON → seed). **Problem:** seed data (`research-content.ts`) has only **5 hardcoded publications**, 3 of which have **empty `content` objects**. The pipeline JSON has actual markdown but no structured CMS. |
| **Briefing Reader** | Read-only markdown modal. No authoring, no editing, no publishing workflow. |
| **Live Feed** | Aggregates HN, Reddit r/ML, arXiv. No Twitter (rate limits). Refreshes every 5 min. |
| **Pipeline Stats** | Derived from client-side filtering. Not connected to a real analytics backend. |

**Critical Gaps:**
- ❌ No article authoring UI
- ❌ No content management system
- ❌ Seed data is stale (last updated 2026-04-24)
- ❌ `content: {}` is empty on most seed publications
- ❌ No draft → review → publish workflow
- ❌ No scheduling
- ❌ ContentPipelineView (in `views/design/`) is actually a **social media scheduler**, not an article pipeline

### 3.2 Research Tab (`views/research/ResearchTab.tsx`)

**Visual Grade: B-**

| Aspect | Assessment |
|--------|------------|
| **Layout** | 3-pane resizable (Source | Chat | Tools). Uses `react-resizable-panels`. Mobile toggle. |
| **Notebook API** | Thin REST client to `localhost:5055`. SSE streaming. |
| **Offline State** | Shows "Research engine offline" with retry. |
| **Source Panel** | Uploads, semantic search, token counts. |
| **Chat Workspace** | Streaming with citation parsing. Regex-based (`/\[(\d+)\]/g`) — fragile. |
| **Tools Panel** | Podcast gen, transforms (summary/briefing/FAQ/timeline), Canvas sync, user notes. |

**Critical Gaps:**
- ❌ **Not a top-level tab.** Research is buried inside A://Labs. OpenNotebook should be its own primary surface.
- ❌ No rich-text / markdown editor for notebook pages
- ❌ Citation parsing is regex-based and will break on complex markdown
- ❌ No sharing backend visible in this repo
- ❌ Canvas sync is manual (button press), not automatic
- ❌ No notebook templates or course-structured notebooks

### 3.3 Tracks Tab (`LabsView.tsx` → `tracks`)

**Visual Grade: B**

| Aspect | Assessment |
|--------|------------|
| **Course Cards** | Visually rich: cover image, tier badge, module count, gradient overlay, capstone box. Hover lift animation. |
| **Tier System** | CORE → OPS → AGENTS → ADV with distinct colors and icons. Clear progression. |
| **Actions** | Open Notebook, Open in Canvas, Sync Canvas, Try Demo. |

**Critical Gaps:**
- ❌ **Courses are fully hardcoded** (`ALABS_COURSES` array). No admin UI. Curriculum changes require code deploy.
- ❌ Only **3 of 10 courses** have demo links (all ADV tier). CORE/OPS/AGENTS have no demos.
- ❌ No lesson-level rendering. App delegates 100% to Canvas LMS.
- ❌ No progress tracking within the app. Canvas is the source of truth.
- ❌ No native quiz taking. Canvas only.
- ❌ No interactive simulations (except 3 ADV static HTML demos).
- ❌ **No OpenMAIC integration** — missing the entire multi-agent classroom paradigm.

### 3.4 Certifications Tab (`views/CertificationsPanel.tsx`)

**Visual Grade: B-**

| Aspect | Assessment |
|--------|------------|
| **Data** | Fetches from `/api/v1/certifications` (SQLite). |
| **Display** | Badge grid grouped by tier. Verified badge. Score. Capstone link. |
| **Empty State** | Prompts users to complete capstones. |

**Critical Gaps:**
- ❌ Certifications are **local-only SQLite records** with no verification against Canvas completion
- ❌ The `verified` flag exists but has no external validation logic
- ❌ No progress bar (% complete) visible in the UI
- ❌ No connection between course cards and certification status

### 3.5 Agent Elements Tab (`views/chat/AgentElementsWorkspace.tsx`)

**Visual Grade: C**

| Aspect | Assessment |
|--------|------------|
| **Purpose** | Internal preview of next-gen agent chat primitives. |
| **Content** | Hardcoded mock messages with tool call previews. |

**Critical Gaps:**
- ❌ **Misplaced.** This is a dev/internal preview tool, not a learning feature. It should not be a top-level tab in a learning portal.
- ❌ Wastes prime navigation real estate.

### 3.6 Settings Tab (`LabsView.tsx` → `settings`)

**Visual Grade: C+**

| Aspect | Assessment |
|--------|------------|
| **Canvas Config** | Token + domain inputs. localStorage persistence. |
| **Instructions** | Step-by-step guide for getting a Canvas token. |

**Critical Gaps:**
- ❌ **Token stored in localStorage** (security risk)
- ❌ No validation of token (test connection button)
- ❌ No org-wide settings (every user must configure individually)
- ❌ No OpenMAIC / LLM provider configuration (needed for integration)

---

## 4. Gap Analysis

### 4.1 Data Architecture Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| Hardcoded courses | 🔴 High | `ALABS_COURSES` is a TS constant. No CMS, no API. |
| Hardcoded demos | 🔴 High | Only 3 courses have demos. No dynamic registry. |
| JSON-file articles | 🔴 High | `discovery-pipeline.json` is a flat file. No DB, no versioning. |
| Empty seed content | 🟡 Medium | `research-content.ts` has 5 pubs, most with `content: {}`. |
| No article editor | 🔴 High | No way to create/edit publications in-app. |
| No course renderer | 🔴 High | App links to Canvas instead of rendering lessons. |
| No quiz engine | 🟡 Medium | Quizzes only in Canvas or static HTML. No React quiz component. |

### 4.2 Integration Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| OpenNotebook buried | 🔴 High | Should be a top-level view, not inside Labs. |
| OpenNotebook external | 🟡 Medium | Depends on port 5055 service. No embedded fallback. |
| No OpenMAIC | 🔴 High | Missing the entire multi-agent classroom stack. |
| Canvas-only courses | 🔴 High | All learning content is external. |
| No lesson generation | 🔴 High | No AI-powered course/lesson generation pipeline. |
| No content ingestion | 🟡 Medium | No way to turn a document/paper into a lesson. |

### 4.3 Visual / UX Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| Inline styles everywhere | 🟡 Medium | ~70% of LabsView is inline styles, not Tailwind or token classes. |
| CSS-in-JS block | 🟡 Medium | `LABS_CSS` is a raw string. No scoped CSS modules. |
| No dark/light toggle | 🟢 Low | Assumes dark theme only. |
| Tab bar overflow | 🟢 Low | `overflow-x: auto` but no scroll indicators. |
| Agent Elements tab | 🟡 Medium | Internal tool exposed to users. |
| Notification toast | 🟢 Low | Fixed position, no stacking, no history. |
| Research offline state | 🟢 Low | Generic error, no "start backend" CTA for web users. |

### 4.4 Pipeline Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| No article pipeline | 🔴 High | `ContentPipelineView` is social media, not articles. |
| No course generation | 🔴 High | `alabs-curator` is WIP. No automated lesson creation. |
| No demo generation | 🟡 Medium | Demos are hand-built or agent-generated one-off. |
| No quiz extraction | 🟡 Medium | Quiz JSON is hand-written. |
| No progress sync | 🟡 Medium | `progress-tracker.ts` exists but is not wired to UI. |

---

## 5. Integration Analysis: OpenMAIC + OpenNotebook + A://Labs

### 5.1 Strategic Fit

OpenMAIC and Allternit share:
- **Stack:** Next.js, React, TypeScript, Tailwind
- **Paradigm:** Multi-agent orchestration (LangGraph ↔ Allternit agent system)
- **Goal:** AI-powered productivity/education
- **License:** OpenMAIC is AGPL-3.0 (compatible with Allternit's open-core model)

### 5.2 Proposed Integration Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     A://Labs Shell                          │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│  │Discovery│ │Research │ │ Courses │ │Classroom│  ...      │
│  │ (feed)  │ │(notebook│ │(tracks) │ │(OpenMAIC│           │
│  │         │ │  fork)  │ │         │ │ lessons)│           │
│  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘           │
│       │           │           │           │                │
│  ┌────┴───────────┴───────────┴───────────┴────┐           │
│  │         Unified Content Backend               │           │
│  │  (SQLite/PostgreSQL + CMS API)                │           │
│  └───────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  OpenNotebook │    │  Canvas LMS   │    │ OpenMAIC Gen  │
│   (port 5055) │    │   (external)  │    │   (port TBD)  │
│               │    │               │    │               │
│ • Notebooks   │    │ • Enrollments │    │ • Lessons     │
│ • Sources     │    │ • Grades      │    │ • Quizzes     │
│ • Chat        │    │ • Assignments │    │ • Sims        │
│ • Podcasts    │    │               │    │ • Whiteboards │
└───────────────┘    └───────────────┘    └───────────────┘
```

### 5.3 Integration Phases

#### Phase 1: Foundation (Week 1-2)
1. **Elevate OpenNotebook** to a top-level view (not inside Labs)
2. **Add "Classroom" tab** to A://Labs (placeholder for OpenMAIC)
3. **Create course CMS API** (`/api/v1/courses`) — migrate `ALABS_COURSES` from hardcoded array to database
4. **Create article CMS API** (`/api/v1/articles`) — replace `discovery-pipeline.json` with proper DB table

#### Phase 2: OpenMAIC Content Pipeline (Week 2-3)
1. **Fork OpenMAIC** into `services/open-maic/` or `cmd/open-maic/`
2. **Build generation bridge:** Allternit topic → OpenMAIC outline → scene JSON
3. **Store generated lessons** in DB with `lesson_type: 'slide' | 'quiz' | 'sim' | 'pbl'`
4. **Render scenes natively** using extracted React components

#### Phase 3: Native Rendering (Week 3-4)
1. **Build `LessonPlayer` component** — slide deck renderer with progress
2. **Build `QuizPlayer` component** — interactive quiz with instant feedback
3. **Build `SimPlayer` component** — iframe sandbox for HTML simulations
4. **Build `Whiteboard` component** — lightweight drawing surface (or integrate tldraw)

#### Phase 4: Multi-Agent Classroom (Week 4-6)
1. **Integrate LangGraph** or bridge to Allternit's existing agent system
2. **AI Teacher persona** — configurable voice, style, avatar
3. **AI Classmates** — seeded discussions, debates, Q&A
4. **TTS integration** — ElevenLabs or similar for narration
5. **ASR integration** — browser Web Speech API for student voice input

### 5.4 OpenNotebook Prominence Plan

**Current State:** OpenNotebook is hidden inside A://Labs → Research tab.

**Target State:**
- **Primary nav:** Add "Notebook" to the global shell rail (`ShellRail.tsx`)
- **A://Labs integration:** Each course card gets "Open Course Notebook" as primary CTA
- **Research tab rename:** "Research" → "Sources & Chat" (clearer purpose)
- **Notebook templates:** Course-structured notebooks (Module 1, Module 2, Capstone)
- **Auto-ingestion:** When a user enrolls in a course, auto-create notebook + ingest course materials

---

## 6. Visual Grade Breakdown

| Area | Grade | Notes |
|------|-------|-------|
| **Typography** | B | Uses `labs-serif`/`labs-display` correctly per DESIGN.md, but inline styles bypass token system. |
| **Color** | B+ | Tier system is clear. Purple accent is consistent. Some hardcoded hexes (`#a78bfa`) instead of tokens. |
| **Layout** | B | Responsive grid. Resizable panels in Research. Tab system is clear. |
| **Animation** | B | Scroll reveal, hover lifts, carousel transitions. RAF progress bar is smooth. |
| **Component Quality** | C | Too much inline CSS. No reuse of `GlassCard`, `GlassSurface` from `design/glass/`. No use of Radix primitives. |
| **Consistency** | C+ | LabsView has its own design language that diverges from the rest of the platform. |
| **Accessibility** | D | No ARIA labels on tabs. Keyboard nav limited to carousel. Color contrast untested. No focus rings. |
| **Mobile** | C | Research tab has mobile toggle. Course grid is responsive. But tabs overflow without scroll hint. |
| **Empty States** | B | Certifications and Research have good empty states. Discovery loading state is generic. |
| **Error States** | C | Research offline state exists. Canvas sync errors show toast. No retry for feed loading. |

**Overall Visual Grade: C+**

The view is **visually ambitious but technically immature**. It looks good in screenshots but is held together by inline styles, hardcoded data, and missing accessibility. For production, it needs:
1. Migration to Tailwind + design tokens
2. Component extraction (Card, Tab, Badge, Button)
3. Accessibility audit
4. Dark/light theme support

---

## 7. DESIGN.md v2 Recommendations

The current `DESIGN.md` is **typography-only** (157 lines). It covers fonts, hierarchy, and migration rules but misses:

### 7.1 Missing Sections (Critical)

```markdown
## Color System
- Semantic tokens: `--surface-canvas`, `--surface-panel`, `--surface-floating`
- Status tokens: `--status-success`, `--status-warning`, `--status-error`, `--status-info`
- Tier tokens: `--tier-core`, `--tier-ops`, `--tier-agents`, `--tier-adv`
- Usage rules: never hardcode hex in components

## Spacing System
- 4px base grid
- `--space-1` through `--space-12`
- Container max-widths
- Section padding standards

## Component Primitives
- Button variants: primary, secondary, ghost, danger
- Card variants: default, elevated, glass
- Tab patterns: underline, pill, sidebar
- Input states: default, focus, error, disabled
- Badge variants: tier, status, outline

## Elevation & Glass
- Glassmorphism rules: blur, saturation, border opacity
- Shadow scale: 0-5 levels
- When to use glass vs solid panels

## Animation Standards
- Duration scale: 150ms (micro), 200ms (standard), 300ms (emphasis)
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` for standard, `cubic-bezier(0.16, 1, 0.3, 1)` for reveal
- Reduced motion support: `@media (prefers-reduced-motion: reduce)`

## Accessibility Requirements
- Minimum contrast ratio: 4.5:1 for text, 3:1 for UI components
- Focus rings: 2px offset, accent color
- ARIA patterns for tabs, dialogs, carousels
- Keyboard navigation: Tab order, arrow keys for lists

## Surface-Specific Rules
- A://Labs: tier color system, serif for headers, sans for UI
- A://Research: serif body, citation styling, source provenance
- Terminal: mono only, ANSI color mapping
- Chat: bubble layout, avatar sizing, timestamp format
```

### 7.2 A://Labs Design Contract (New Section)

```markdown
## A://Labs Design Contract

### Tab Order
1. Discovery — feed, carousel, pipeline stats
2. Classroom — native lessons (OpenMAIC scenes)
3. Research — OpenNotebook workspace
4. Tracks — course catalog by tier
5. Certifications — badge gallery

### Tier Visual System
| Tier | Color Token | Hex | Icon | Usage |
|------|-------------|-----|------|-------|
| CORE | `--tier-core` | `#3b82f6` | Layers | Foundations |
| OPS | `--tier-ops` | `#8b5cf6` | BarChart3 | Operations |
| AGENTS | `--tier-agents` | `#ec4899` | Rocket | Agent systems |
| ADV | `--tier-adv` | `#f59e0b` | GraduationCap | Advanced |

### Course Card Anatomy
- Cover image: 16:9, object-fit cover, gradient overlay
- Tier badge: top-left, glassmorphism, uppercase
- Module count: top-right, muted
- Title: serif, italic, 17px, weight 900
- Description: sans, 12.5px, 3-line clamp
- Capstone box: tinted background, border
- Actions: primary gradient CTA, secondary outline, icon-only external

### Forbidden Patterns
- No inline `style={{}}` on components (use Tailwind + cn())
- No hardcoded colors (use tokens)
- No arbitrary font sizes (use type scale)
- No `!important` in CSS
```

### 7.3 Migration Checklist

- [ ] Extract `LABS_CSS` into `labs.module.css` or Tailwind plugin
- [ ] Replace inline styles in `LabsView.tsx` with Tailwind classes + `cn()`
- [ ] Replace inline styles in `DiscoveryFeed.tsx` with design tokens
- [ ] Replace inline styles in `ResearchTab.tsx` with design tokens
- [ ] Use `GlassCard` / `GlassSurface` from `design/glass/` instead of custom glass
- [ ] Add ARIA roles to tab system (`role="tablist"`, `role="tab"`, `role="tabpanel"`)
- [ ] Add keyboard navigation to tabs (arrow keys)
- [ ] Implement `prefers-reduced-motion` for all animations
- [ ] Validate contrast ratios with automated tooling

---

## 8. Actionable Roadmap

### Immediate (This Week)

1. **Write new DESIGN.md** with sections from §7 above
2. **Remove Agent Elements tab** from LabsView (or move to dev-only flag)
3. **Add OpenNotebook to global nav** (`ShellRail.tsx`)
4. **Create `/api/v1/courses` endpoint** — migrate `ALABS_COURSES` to DB
5. **Create `/api/v1/articles` endpoint** — migrate `discovery-pipeline.json` to DB
6. **Add "Classroom" tab** to LabsView (placeholder)

### Short Term (2-3 Weeks)

7. **Fork OpenMAIC** into `services/open-maic/`
8. **Build lesson generation bridge** — topic → OpenMAIC → scene JSON
9. **Extract React components** from OpenMAIC: `SlideDeck`, `QuizPlayer`, `SimSandbox`
10. **Build demo lessons** for CORE tier courses (replace Canvas-only)
11. **Add progress tracking** to course cards (% complete from Canvas or local)
12. **Auto-create notebooks** on course enrollment

### Medium Term (1-2 Months)

13. **Native lesson renderer** — replace Canvas links with in-app lesson player
14. **Multi-agent classroom** — AI teacher + classmates integration
15. **TTS/ASR** — voice narration and student voice input
16. **Whiteboard integration** — tldraw or custom canvas for collaborative drawing
17. **Article authoring UI** — markdown editor with preview, publish workflow
18. **Content pipeline** — GitHub Action or in-app generation for articles

### Long Term (3-6 Months)

19. **alabs-curator CLI completion** — generalize for any codebase
20. **Course marketplace** — community-generated courses
21. **Certification verification** — blockchain or signed credentials
22. **Mobile app** — React Native or PWA for offline learning

---

## 9. Files to Modify / Create

### Modify
- `DESIGN.md` — expand to full design system
- `src/shell/ShellRail.tsx` — add Notebook nav item
- `src/shell/ShellApp.tsx` — register notebook view, register classroom view
- `src/views/LabsView.tsx` — remove Agent Elements tab, add Classroom tab, DB-driven courses
- `src/views/discovery/DiscoveryFeed.tsx` — DB-driven feed, remove hardcoded seed
- `src/views/research/ResearchTab.tsx` — use design tokens, improve citation parsing
- `src/views/CertificationsPanel.tsx` — connect to Canvas for verification

### Create
- `src/views/classroom/ClassroomTab.tsx` — OpenMAIC lesson player
- `src/views/classroom/components/SlideDeck.tsx`
- `src/views/classroom/components/QuizPlayer.tsx`
- `src/views/classroom/components/SimSandbox.tsx`
- `src/app/api/v1/courses/route.ts` — course CRUD
- `src/app/api/v1/articles/route.ts` — article CRUD
- `src/app/api/v1/lessons/route.ts` — lesson content API
- `src/lib/db/schema-sqlite.ts` — add `courses`, `articles`, `lessons`, `enrollments` tables
- `services/open-maic/` — OpenMAIC fork or service wrapper

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| OpenMAIC AGPL-3.0 license conflict | Medium | High | Use as external service (API call), not linked binary. Or negotiate commercial license. |
| LangGraph dependency bloat | Medium | Medium | Run OpenMAIC as separate service, not in main Next.js bundle. |
| Canvas LMS API changes | Low | Medium | Abstract Canvas integration behind adapter pattern. |
| TTS/ASR browser support | Medium | Low | Graceful degradation to text-only. |
| Performance of generated lessons | Medium | Medium | Lazy load scenes, code-split classroom bundle. |

---

**End of Audit.**
