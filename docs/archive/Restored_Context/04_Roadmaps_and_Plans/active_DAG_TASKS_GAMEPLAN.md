# DAG TASKS - GAMEPLAN FOR APPROVAL

**Date:** 2026-02-22
**Status:** Awaiting Approval
**Purpose:** Present options before implementation

---

## CURRENT STATE ANALYSIS

### 1. Agentation (Dev Tool)

**What It Is:**
- UI annotation tool for developers
- Allows clicking UI elements to generate Allternit agent instructions
- Similar to Storybook addons or browser dev tools

**Current Implementation:**
```
Location: surfaces/allternit-platform/src/dev/agentation/
Status: ✅ Fully implemented
Gating: NODE_ENV === 'development' (dev-only)
```

**Current Invocation Points:**
1. **Storybook Integration** (`.storybook/preview.tsx`)
   - AgentationOverlay wraps Storybook stories
   - Activated by pressing 'A' key in Storybook
   - Shows floating panel for annotations

2. **NOT Currently Mounted in Main App**
   - AgentationProvider is NOT in App.tsx
   - AgentationPanel is NOT rendered anywhere in production
   - Only accessible via Storybook

**Files:**
- `src/dev/agentation/provider.tsx` - React context provider
- `src/dev/agentation/panel.tsx` - Floating UI panel
- `src/dev/agentation/components/AgentationOverlay.tsx` - Storybook overlay
- `src/dev/agentation/storybook-integration.tsx` - Storybook decorator

---

### 2. Storybook Evidence Lane

**What It Is:**
- CI/CD pipeline for UI validation
- Runs Storybook builds, interaction tests, visual regression
- Emits evidence receipts to WIH

**Current Implementation:**
```
Location: scripts/ui-evidence-lane.sh
Status: ✅ Script exists
Integration: CI/CD pipeline (not UI)
```

**Current Invocation:**
- Run via `npm run evidence:ui` command
- Called by CI/CD pipeline
- NOT a UI feature - it's a build/CI script

**Files:**
- `scripts/ui-evidence-lane.sh` - Main script (200 lines)
- `.storybook/main.ts` - Storybook config with evidence emission
- `docs/AGENTATION.md` - Usage documentation

---

### 3. ShellUI Modes (Existing Architecture)

**Three Distinct Modes:**

| Mode | Config | Users | Purpose |
|------|--------|-------|---------|
| **global** | `rail.config.ts` | End users | Consumer app |
| **cowork** | `cowork.config.ts` | Team users | Collaboration |
| **code** | `code.config.ts` | Developers | Dev environment |

**Current Structure:**
- Each mode has separate navigation rail
- Different items shown per mode
- Mode switched via `mode` prop in ShellRail

---

## PROBLEM STATEMENT

### What Needs to Be Solved:

1. **Agentation Access**
   - Currently ONLY in Storybook
   - Should developers have access in main app dev mode?
   - If yes, where and how?

2. **Storybook Evidence Lane**
   - Currently a CI/CD script
   - Should there be a UI to view evidence/triggers?
   - If yes, where?

3. **DAG Task Views Organization**
   - 20+ backend crates need UI surfaces
   - Can't all go in global mode (wrong audience)
   - Need proper categorization by user type

---

## OPTIONS FOR APPROVAL

### Option A: Minimal Changes (Recommended)

**Agentation:**
- ✅ Leave as Storybook-only (already working)
- ❌ Don't add to main app navigation
- **Rationale:** It's a dev tool, Storybook is the right place

**Storybook Evidence:**
- ✅ Leave as CI/CD script
- ❌ Don't create UI for it
- **Rationale:** Evidence is for CI/CD, not user-facing

**DAG Task Views:**
- ✅ Add Infrastructure/Security/Observability to CODE mode only
- ✅ Add AI & Vision (IVKGE, Multimodal, Tambo) to GLOBAL mode
- ✅ Add Governance (Receipts, Purpose) to COWORK mode
- **Rationale:** Respects existing mode architecture

**Navigation Impact:**
- Global mode: +3 items (AI & Vision category)
- Code mode: +15 items (4 new categories)
- Cowork mode: +2 items (Governance category)

---

### Option B: Full Integration

**Agentation:**
- ✅ Add AgentationProvider to App.tsx (dev mode only)
- ✅ Add "Agentation" toggle to Settings or Dev menu
- ✅ Show AgentationPanel when enabled
- **Rationale:** Developers can use without opening Storybook

**Storybook Evidence:**
- ✅ Create "Evidence" view in Code mode
- ✅ Show evidence history, trigger manual runs
- **Rationale:** Visibility into CI/CD evidence

**DAG Task Views:**
- Same as Option A

**Navigation Impact:**
- Global mode: +4 items (AI & Vision + Agentation toggle)
- Code mode: +16 items (4 new categories + Evidence)
- Cowork mode: +2 items

---

### Option C: Separate Dev Tools Panel

**Agentation:**
- ✅ Create "Dev Tools" panel (like browser DevTools)
- ✅ Accessible via keyboard shortcut (Cmd+Shift+D)
- ✅ Contains Agentation + other dev tools
- **Rationale:** Keeps dev tools separate from main UI

**Storybook Evidence:**
- ✅ Add to Dev Tools panel
- ✅ Evidence viewer + trigger
- **Rationale:** Dev-focused feature

**DAG Task Views:**
- Same as Option A

**Navigation Impact:**
- No changes to rail navigation
- Dev Tools panel separate (like browser DevTools)

---

## RECOMMENDATION

**Option A + Option C Hybrid:**

1. **Agentation:** Keep in Storybook ONLY
   - Already working correctly
   - Storybook is the right context for UI annotation
   - No changes needed

2. **Storybook Evidence:** CI/CD script only
   - Not a user-facing feature
   - No UI needed

3. **DAG Task Views:** Organize by mode
   - Global: AI & Vision (user-facing)
   - Code: Infrastructure, Security, Observability, DAG (dev tools)
   - Cowork: Governance (team features)

4. **Create Dev Tools Panel (Future)**
   - Separate from main navigation
   - Keyboard shortcut access
   - For future dev tools (not just Agentation)

---

## FILES TO MODIFY (Option A)

### 1. `rail.config.ts` (Global Mode)
**Add:**
```typescript
{
  id: 'ai-vision',
  title: 'AI & Vision',
  items: [
    { id: 'ivkge', label: 'IVKGE', icon: Eye, payload: 'ivkge' },
    { id: 'multimodal', label: 'Multimodal', icon: Image, payload: 'multimodal' },
    { id: 'tambo', label: 'Tambo UI Gen', icon: Palette, payload: 'tambo' },
  ]
}
```

### 2. `code.config.ts` (Code Mode)
**Add:**
- Infrastructure category (4 items)
- Security category (3 items)
- Observability category (3 items)
- DAG category (3 items)

### 3. `cowork.config.ts` (Cowork Mode)
**Add:**
- Governance category (2 items)

### 4. `ShellApp.tsx`
**No changes needed** - views already registered

---

## DECISION REQUIRED

**Please approve one of the following:**

- [ ] **Option A** - Minimal changes (recommended)
- [ ] **Option B** - Full integration
- [ ] **Option C** - Separate Dev Tools panel
- [ ] **Option A+C Hybrid** - My recommendation
- [ ] **Other** - Specify alternative

**Additional Notes:**
- Agentation is ALREADY implemented correctly (Storybook-only)
- Storybook Evidence is ALREADY implemented (CI/CD script)
- Only DAG Task Views need organization by mode

---

**Awaiting approval before proceeding.**
