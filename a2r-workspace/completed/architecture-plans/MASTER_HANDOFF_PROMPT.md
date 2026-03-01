# ✅ MASTER HANDOFF PROMPT (PASTE TO AGENT)

You are the new coding agent for the A2rchitech monorepo.

## Mission

Ship 5 deliverables end-to-end, using **REAL implementations (no stubs)**, and align the platform to an Agentic Engineering OS where:

- `a2` CLI is the **top-level process**.
- It spawns other CLIs (OpenCode, Claude Code, Codex, Amp, Goose, Aider, Qwen, Gemini, Cursor, Verdant) as **subprocess "brains" via PTY**.
- **OpenWork** is forked and integrated as a **first-class Ops Center tab** in the Shell UI.
- **UI-TARS** is wired as a tool for **computer-use automation** (screenshot → propose → execute loop).
- Capsule icons are **custom SVG assets (not emojis)**, preferably vendor assets.

---

## Inputs Already Available (Read These First)

- `/mnt/data/A2_AUDIT_MAP.md`
- `/mnt/data/A2_REUSE_VS_BUILD.md`
- `/mnt/data/A2_IMPLEMENTATION_PLAN.md`
- `/mnt/data/AGENT_HANDOFF_PACKAGE.md`
- `/mnt/data/MASTER_AGENT_AUDIT_AND_EXECUTION_PROMPT.md`

---

## Hard Constraints

- **Electron only.** Tauri is already deleted; remove remaining references/paths/flags/scripts/docs.
- **No "placeholder UI".** If something is not wired, wire it. If something is missing, implement minimal working version.
- **Do not invent CLIs that don't exist.** If a tool is not actually a CLI, treat it as (a) a provider integration via adapter, or (b) a UI-only integration, and document the truth.

---

## Definition of Done

All 5 deliverables below exist, can be demo'd, and have acceptance tests or at minimum runnable smoke checks.

---

# DELIVERABLE 1/5 — PTY Brain Wrappers (Expanded List)

## Goal

Implement PTY-backed "Brain Drivers" that run each external CLI as a subprocess and stream events to the Shell UI in the same event bus format used by existing Brain Runtime (`chat.delta` / `terminal.delta` / `tool.call` / `tool.result`).

## Tools to Support via PTY (Expanded)

- **opencode**
- **claude code**
- **codex** (OpenAI)
- **amp** (Sourcegraph Amp CLI) — *note: Amp is distributed as an npm package, uses `amp` binary* (see npm page for install docs)
- **goose**
- **aider**
- **qwen** (Qwen code tooling if CLI exists; otherwise document and skip)
- **gemini cli** (Google Gemini CLI)
- **cursor** (Cursor may not have an official CLI; verify; if none, document and implement provider adapter instead)
- **verdant** (verify if actual CLI exists; if none, document)

## Work Items

### 1) Inventory

- Locate existing Brain Runtime driver interfaces + TerminalManager PTY infra.
- Identify how sessions stream events to UI (SSE or equivalent).

### 2) Core Abstraction

Implement a generic `PtyBrainDriver` (or equivalent) that:

- Spawns process in a PTY.
- Resizes PTY on window resize events.
- Streams stdout/stderr as `terminal.delta`.
- Accepts stdin writes from UI (terminal input).
- Has lifecycle (start/stop/kill).
- Supports "prompt injection" where needed (send initial command sequence).

### 3) Per-Tool Adapter Configs

For each CLI tool, add a config module:

- **command, args, env, cwd, bootstrap sequence**
- **detection**: is binary installed? (`which` / where)
- **install hints**: (but do not auto-install unless we already have safe installer infra)

**Output capabilities:**

- supports streaming output?
- supports structured events? (most will be plain text)

**Normalize into a common adapter interface.**

### 4) CLI Session Commands

- Add `a2 brain start --tool <name> --workspace <path> ...`
- Add `a2 brain list`, `a2 brain stop`, `a2 brain attach`, `a2 brain logs`
- Add `a2 which <tool>` to show detection results.

## Acceptance Criteria

- [ ] Starting a PTY brain produces terminal output in the UI.
- [ ] Typing into the UI sends keystrokes to the PTY.
- [ ] Resizing the capsule updates PTY size.
- [ ] At least 3 tools work end-to-end in real life: pick (amp + gemini + aider) or (opencode + amp + claude) depending on which are installed.

## Notes

- **Amp CLI** install docs live on npm. It's a real CLI: `amp`. (https://www.npmjs.com/package/@sourcegraph/amp)
- **Gemini CLI** existence should be verified in repo/docs; it has been reported publicly as open-source/public preview. Ensure real binary name and install method. (news coverage exists; verify primary source when implementing)

---

# DELIVERABLE 2/5 — A2 CLI as "Top Process"

## Goal

Package `a2` as a first-class CLI product similar to claude/opencode/gemini, acting as orchestrator:

- launches subordinate CLIs as subprocess brains
- exposes unified commands for other project CLIs in the monorepo
- can run as a daemon/service when needed

## Work Items

### 1) Determine Current CLI/Daemon Infra

- Find any existing `a2` daemon runner, IO runner, kernel CLI, etc.
- Identify command routing and plugin architecture.

### 2) Implement `a2` Command Surface

#### a) Brain

- `a2 brain start/stop/list/attach`

#### b) Tools

- `a2 tools list`
- `a2 tools run <tool> -- <args>` (forwarding)

#### c) Repo

- `a2 repo scan` → produces CODEBASE.md (or integrates with existing CODEBASE generator)

#### d) Shell

- `a2 shell dev` (starts correct web + electron)
- `a2 shell logs`

### 3) Subprocess Management

- Use PTY for interactive tools, plain spawn for non-interactive.
- Ensure clean shutdown and zombie avoidance.
- Persist session metadata for UI reattach.

## Acceptance Criteria

- [ ] `a2 --help` shows a coherent product-level CLI.
- [ ] `a2 brain start --tool amp` starts an interactive session visible in Shell UI.
- [ ] `a2 shell dev` runs correct Electron + Vite processes.

---

# DELIVERABLE 3/5 — Fork OpenWork and Integrate as "Ops Center" Tab

## Goal

Fork OpenWork (GUI wrapper for OpenCode) and integrate it as a real tab inside A2rchitech Shell UI.

**No stub.** We want their exact implementation as baseline, then modify it.

## Work Items

### 1) Fork

- Add OpenWork as a git submodule or subtree under `apps/openwork` (choose whatever is consistent with repo law).
- Make it build in our monorepo tooling.

### 2) Integration

- Add a Shell UI left-rail entry + a tab that renders OpenWork.

**Options:**

**A)** Embed as a webview/browser capsule pointing to OpenWork dev server
**B)** Compile OpenWork UI as a package and import it as a route/view

**Prefer** the approach that keeps OpenWork "as-is" while still being a first-class tab.

### 3) Wiring

- OpenWork should point to our `a2` brain/session API (not raw opencode).
- If OpenWork expects OpenCode server: we run OpenCode via `a2 brain start --tool opencode --mode server` and proxy it.

## Acceptance Criteria

- [ ] Clicking "Ops Center" tab launches OpenWork UI inside Shell.
- [ ] You can start at least one coding session from inside that view.
- [ ] Sessions show in Activity/Events like other brains.

---

# DELIVERABLE 4/5 — UI-TARS Computer Use Tool (Real Automation Loop)

## Goal

UI-TARS is not just "in repo"; it must be usable as a Tool:

- take screenshot
- send to UI-TARS operator
- receive action proposals
- execute actions (mouse/keyboard)
- loop with verification screenshots

## Work Items

### 1) Confirm UI-TARS Fork Location and Current State

### 2) Implement Tool

- `tool.ui.screenshot()`
- `tool.ui.click(x,y)`
- `tool.ui.type(text)`
- `tool.ui.scroll(delta)`
- `tool.ui.run(task)` → full loop:
    screenshot → propose → execute → screenshot → until done/timeout

### 3) Safety/Permissions

- Require explicit user approval for first run.
- Add "dry run" mode: show proposals without executing.

### 4) UI Integration

- Expose UI-TARS tool to PTY brain wrapper environment or native brains.
- Show action feed in Inspector miniapp.

## Acceptance Criteria

- [ ] A demo script can open an app or click a button successfully.
- [ ] The loop updates UI with each step (proposal + execution result).

---

# DELIVERABLE 5/5 — Capsule Icons + Vendor Asset Pipeline (No Emojis)

## Goal

When capsules are created (Browser, Ops Center, PTY Brain sessions), the icon should be:

- a custom SVG (not emoji)
- ideally sourced from the vendor/project brand assets when allowed
- with a fallback A2-designed glyph

## Work Items

### 1) Implement Icon Registry

- `CapsuleIconRegistry` maps capsule type + tool name → SVG asset.
- `CapsuleIcon` component renders inline SVG.
- Dock/TabStrip/Window title bar all use it.

### 2) Vendor Asset Pipeline

- Create `/apps/shell/src/iconography/vendor/<tool>.svg`
- Add `/apps/shell/src/iconography/generated/<fallback>.svg`
- Add a script `scripts/icons/sync_vendor_icons.(ts|js)`:
    - pulls icons from submodules OR copies from `third_party_assets/`
    - validates dimensions, monochrome variants, stroke widths
    - outputs an index file with imports.

### 3) Where to Source Assets

- Prefer official brand kit or project repo `assets/` folder.
- Document licensing per icon and keep LICENSE file alongside vendor svgs.
- If a tool has no permissive icon, use fallback glyph and document.

## Acceptance Criteria

- [ ] New capsule creation never shows emoji icons.
- [ ] Tabs and dock show correct per-tool icons (Amp, Gemini, Aider, etc.).

---

# EXECUTION REQUIREMENTS (HOW YOU WORK)

## 1) Start by Re-Auditing the Repo Yourself

**Do NOT trust prior summaries.**

Create `docs/audit/CLI_PTY_OPENWORK_UITARS_REAUDIT.md` with:

- file paths and line evidence
- what is reusable vs missing
- exact wiring points for Shell UI tabs and Brain Runtime events

## 2) Produce Working Patches in Small Commits

- **commit 1:** PTY driver minimal + one tool works
- **commit 2:** A2 CLI commands
- **commit 3:** OpenWork fork integrated (even if not fully wired)
- **commit 4:** UI-TARS tool loop demo
- **commit 5:** icon pipeline + registry replacement

## 3) Add a Demo Checklist

- `docs/demo/CLI_PTY_OPENWORK_UITARS_DEMO.md`
- Include expected logs and screenshots to capture.

---

# STOP ONLY WHEN ALL 5 DELIVERABLES PASS SMOKE CHECKS

---

# IMPORTANT NOTES (So Your Agent Doesn't Drift)

### Amp

- Amp is a real CLI distributed via npm and installed as `amp` (Sourcegraph).
- Reference: https://www.npmjs.com/package/@sourcegraph/amp

### Codex

- Codex is an OpenAI coding product; if "Codex CLI" is not a real binary in your environment, your agent must implement it as a provider/adapter (or document absence).

### Gemini CLI

- Gemini CLI exists publicly (at least as reported), but your agent must confirm primary install/source before claiming support.

---

# WHAT YOU'LL GET AFTER AGENT RUNS THIS

1. **PTY brains** for more than the original list (your expanded set), with real streaming sessions.
2. **a2 as product CLI** that orchestrates everything.
3. **OpenWork fork** embedded as a real Ops Center tab.
4. **UI-TARS tool** that can actually drive the UI.
5. **Capsule icons** that are real SVG assets (vendor where allowed), not emoji.

---

# ENVIRONMENT SETUP (If Needed)

If you want to provide your repo root path + current workspace manager (pnpm/npm/bun), I'll rewrite the prompt to match your exact scripts/commands so the agent doesn't waste cycles on boot issues.

---

**END OF MASTER HANDOFF PROMPT**
