# h5i Integration Research for Allternit

**Date:** 2026-04-24  
**Author:** Kimi Code CLI  
**Scope:** Evaluate h5i (AI-aware Git sidecar) for integration with Allternit's multi-session canvas code mode.

---

## 1. What is h5i?

[h5i](https://h5i.dev/) (pronounced "high-five") is an open-source Rust CLI tool that acts as a **Git sidecar** for AI-generated code. It stores AI session metadata — prompts, model used, decisions, uncertainty moments, and file touches — as first-class Git artifacts in dedicated refs (`refs/h5i/*`), without polluting the working tree or branch graph.

### Core Commands

| Command | Purpose |
|---------|---------|
| `h5i context` | Records goals, milestones, OBSERVE/THINK/ACT traces per session |
| `h5i claims` | Pins facts to files (content-addressed, auto-invalidates on edit) |
| `h5i summary` | Per-file orientation keyed by blob OID, auto-invalidates on edit |
| `h5i notes` | Ranks commits by uncertainty/blind edits for human review |
| `h5i vibe` | 5-second audit of AI footprint and security risks |
| `h5i serve` | Web dashboard on localhost:7150 |

### Proven Benefits (from h5i benchmarks, N=10)

| Metric | Reduction |
|--------|-----------|
| Cache-read tokens | **−69%** (with claims) / **−46%** (with summaries) |
| Read tool calls | **−81%** |
| Assistant turns | **−63%** (claims) / **−40%** (summaries) |
| Wall time | **−56%** (claims) / **−23%** (summaries) |

### Storage Model

h5i uses dedicated Git refs — content-addressed, dedup'd, pushable, survive `git gc`:

| Ref | Contents |
|-----|----------|
| `refs/h5i/notes` | Per-commit metadata (model, agent, prompt, tokens, decisions) |
| `refs/h5i/context` | Reasoning workspace as a DAG |
| `refs/h5i/ast` | AST snapshots for structural blame |
| `refs/h5i/checkpoints/<agent>` | Per-agent memory snapshots |

---

## 2. Current State of Allternit's Code Mode

### Architecture (from Phase 1–4 implementation)

```
┌─────────────────────────────────────────────────────────────┐
│  Allternit Platform (Next.js)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ CodeThread  │  │ CodeCanvas  │  │ CodeSessionStore    │ │
│  │  (single)   │◄─┤  (tiles)    │  │  (Zustand + API)    │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────────┘ │
│                          │                                  │
│                    ┌─────┴─────┐                           │
│                    │ CanvasTile│──► StreamingChatComposer   │
│                    │ (session) │    CompactChatComposer     │
│                    └───────────┘                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ PreviewTile │  │  DiffTile   │  │  TerminalTile       │ │
│  │  (iframe)   │  │  (unified)  │  │  (xterm.js)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           │
                    WebSocket / HTTP
                           │
┌─────────────────────────────────────────────────────────────┐
│  Backend                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │allternit-api│  │gizzi-code   │  │  VM sessions        │ │
│  │  (Rust)     │  │(TS/Bun)     │  │  (Firecracker/AVF)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Key Gaps Relevant to h5i

1. **`files_touched` is a stub** — `CodeSessionRecord.files_touched: string[]` exists in the store but is initialized empty and never populated by any store action or backend callback.

2. **No AI provenance tracking** — Git commits made by agent sessions carry no metadata about which model, prompt, or reasoning path produced them.

3. **Session resume is file-based** — Gizzi-code has handoff batons (`.gizzi/L1-COGNITIVE/brain/batons/*.md`) but no structured reasoning DAG like h5i's `refs/h5i/context`.

4. **No claims/summaries system** — Agents re-derive codebase facts every session. There is no content-addressed fact pinning.

5. **Audit gap** — No systematic way to audit AI footprint, detect prompt injection attempts, or rank commits by uncertainty.

---

## 3. Integration Opportunities

### 3.1 Tier 1: Low-Hanging Fruit (High Value, Low Effort)

#### A. Populate `files_touched` via h5i context

**What:** Wire the backend to populate `files_touched` when agents modify files, and store the reasoning in h5i.

**How:**
- In `gizzi-code/src/runtime/session/snapshot/snapshot.ts`, after `track()` detects a file change, emit an h5i trace entry.
- Surface `files_touched` in the canvas tile header (already wired in `CodeSessionBar.tsx`).

**Value:** Makes the canvas tiles immediately more useful — users see which files each session touched.

#### B. h5i `vibe` as a workspace health check

**What:** Run `h5i vibe` periodically on the active workspace and surface results in the UI.

**How:**
- Add a "Workspace Audit" button in `CanvasToolbar` or `CodeRail`.
- Run `h5i vibe` via the VM session executor (`POST /vm-session/:id/execute`).
- Display risk score and flagged files in a canvas tile or HUD panel.

**Value:** Security and compliance visibility without changing the agent workflow.

### 3.2 Tier 2: Medium Investment (Structural Improvements)

#### C. Per-session h5i context workspaces

**What:** Each canvas tile session gets its own h5i context workspace (goal, milestones, OBSERVE/THINK/ACT trace).

**How:**
- On session creation (`createCodeSession`), also run `h5i context init --session <sessionId>`.
- Stream h5i trace entries alongside chat messages in `CodeCanvasTileSession`.
- Store context in `refs/h5i/context/<sessionId>`.

**Value:** Full reasoning trace per tile. Enables session handoff, time-travel, and diff of reasoning.

#### D. Claims and summaries as "Knowledge Tiles"

**What:** Surface h5i claims and summaries as first-class tiles on the canvas.

**How:**
- New tile type: `'knowledge'`.
- `h5i claims list --live` → spawn knowledge tiles for each live claim.
- `h5i summary list` → spawn knowledge tiles for summarized files.
- Auto-invalidate tiles when claims go stale (poll or watch `refs/h5i/`).

**Value:** Visualizes institutional knowledge on the canvas. Agents (and humans) see pinned facts without re-deriving them.

#### E. h5i commit integration

**What:** Replace `git commit` in agent sessions with `h5i commit` to attach provenance.

**How:**
- In `gizzi-code/src/runtime/loop/executor.ts` or git tools, intercept commit operations.
- Auto-detect model/agent from session metadata.
- Attach prompt and decisions from h5i context.

**Value:** Every commit knows who (which agent), why (prompt), and how (reasoning trace) it was made.

### 3.3 Tier 3: Deep Integration (High Investment, Transformative)

#### F. h5i dashboard as a preview tile

**What:** Embed `h5i serve` dashboard inside a canvas preview tile.

**How:**
- Run `h5i serve` as a background service in the VM or on the host.
- Point a preview tile iframe to `http://localhost:7150`.
- Filter dashboard to show only the current workspace's context.

**Value:** Rich audit timeline, uncertainty heatmap, and churn visualization inside the canvas.

#### G. h5i MCP server for agent self-awareness

**What:** Mount h5i's MCP server so agents can query their own history.

**How:**
- Add h5i MCP server config to the agent runtime.
- Agents can call `h5i_log`, `h5i_blame`, `h5i_context_trace` as tools.
- Agents self-audit before making changes.

**Value:** Agents become self-aware — they know what they did last session and why.

#### H. Reasoning diff between sessions

**What:** Diff the reasoning traces (not just code) between two canvas tile sessions.

**How:**
- `h5i context diff <sessionA> <sessionB>`.
- Render in a diff tile showing THINK/ACT divergence.

**Value:** Understand why two agents took different approaches to the same problem.

---

## 4. Integration Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Allternit Canvas (Next.js)                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐ │
│  │ SessionTile │  │ Knowledge   │  │  Preview    │  │  Audit    │ │
│  │             │  │   Tile      │  │  (h5i web)  │  │   HUD     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘ │
│         │                │                │               │       │
│         └────────────────┴────────────────┘               │       │
│                          │                                │       │
│                    ┌─────┴─────┐                   ┌──────┴──────┐│
│                    │ h5i CLI   │◄──────────────────│  h5i vibe   ││
│                    │ (Rust)    │                   │  (periodic) ││
│                    └─────┬─────┘                   └─────────────┘│
└──────────────────────────┼────────────────────────────────────────┘
                           │  Git refs (refs/h5i/*)
                           │
┌──────────────────────────┼────────────────────────────────────────┐
│  Gizzi-code Runtime      │                                        │
│  ┌─────────────┐  ┌──────┴──────┐  ┌───────────────────────────┐ │
│  │  Session    │  │ h5i context │  │  h5i claims / summary     │ │
│  │  Executor   │──┤  trace      │  │  (auto-pin on discovery)  │ │
│  └─────────────┘  └─────────────┘  └───────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────────────────────────────────────┐ │
│  │ Git Snapshot│  │  Handoff Baton (existing)                   │ │
│  │  (track)    │──┤  + h5i context DAG (enhanced)               │ │
│  └─────────────┘  └─────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. Recommendation

### Verdict: **Integrate in tiers. Start with Tier 1.**

h5i is a strong fit for Allternit because:

1. **It fills the `files_touched` stub** — Immediate value with minimal code change.
2. **It aligns with the canvas philosophy** — Multi-session, spatial, observable. h5i's context DAG maps naturally to canvas tiles.
3. **It reduces token costs** — The benchmarked −69% cache-read reduction directly lowers API costs for Allternit's agent sessions.
4. **It enhances governance** — Allternit has a tenant/governance model. h5i's audit trail (`vibe`, `compliance`, `notes review`) provides the provenance layer governance needs.
5. **It's non-intrusive** — h5i stores data in Git refs, not the working tree. It can be adopted gradually, workspace by workspace.

### Suggested Implementation Order

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Wire `files_touched` → h5i context trace | 1 day | High |
| 2 | `h5i vibe` workspace audit button | 1 day | Medium |
| 3 | Per-session h5i context workspaces | 3 days | High |
| 4 | Knowledge tiles (claims/summaries) | 3 days | High |
| 5 | h5i commit provenance | 2 days | Medium |
| 6 | h5i dashboard preview tile | 2 days | Medium |
| 7 | h5i MCP server integration | 3 days | High |

### Risks

| Risk | Mitigation |
|------|------------|
| h5i is pre-1.0 | Pin to a known-good commit; monitor releases |
| Rust toolchain required | Already present in Allternit monorepo |
| Git ref pollution | h5i refs are isolated; `git push` ignores them by default |
| Session metadata explosion | h5i content-addresses and dedups; runs `git gc` |

---

## 6. Quick Experiment

To validate the integration before committing engineering time:

```bash
# 1. Install h5i
cargo install --git https://github.com/Koukyosyumei/h5i h5i-core

# 2. Init in an Allternit workspace
cd /path/to/workspace
h5i init

# 3. Run a canvas session, then capture context
h5i context start --goal "Refactor auth module"
# ... run agent session ...
h5i context finish

# 4. Inspect
h5i log
h5i vibe

# 5. Serve dashboard
h5i serve
```

If the log and vibe output are useful, proceed with Tier 1 integration.
