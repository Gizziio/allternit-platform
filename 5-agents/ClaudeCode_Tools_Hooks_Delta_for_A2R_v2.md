# Claude Code tools + hooks (official baseline) — Delta for A2R (v2)

This updates the previously-locked list using **Claude Docs** pages for:
- Claude Code **tools** table in Settings
- Claude Code **hook events** reference
- Claude Code **headless flags** relevant to “execution permission” modes

## 1) Tool surface (Claude Code baseline)

From Claude Code Settings → “Tools available to Claude”:

| Tool | Permission required | Notes for A2R ToolRegistry |
|---|---:|---|
| Bash | Yes | treat as high-risk; always gate via PolicyEngine + path guard |
| Edit | Yes | write-like; enforce allowed_paths + protected paths |
| Glob | No | read-only |
| Grep | No | read-only |
| NotebookEdit | Yes | write-like; treat as high-risk |
| NotebookRead | No | read-only |
| Read | No | read-only |
| SlashCommand | Yes | executes *custom* slash commands; model sees metadata only |
| Task | No | spawns subagent; maps to WorkerManager.spawn() |
| TodoWrite | No | structured task lists; maps to Planning-with-Files / DAG staging |
| WebFetch | Yes | must snapshot fetched content as an artifact for replay |
| WebSearch | Yes | must snapshot search results; prefer domain filters |
| Write | Yes | write-like; enforce workspace + allowed_paths |

## 2) Hook lifecycle events (Claude Code baseline)

From Claude Code Hooks reference, supported events include:
- SessionStart
- UserPromptSubmit
- PreToolUse
- PostToolUse
- Notification
- Stop
- SubagentStop
- PreCompact
- SessionEnd

### A2R mapping rule
A2R should treat these as *kernel stages* around every agent action:
- PreToolUse is the **hard choke point** (policy + schema + WIH scope + leases)
- PostToolUse is evidence capture + postconditions
- PreCompact triggers ContextPack sealing before any summarization

## 3) Execution permission modes (headless)

Claude Code headless mode shows:
- `--allowedTools` for tool allowlist
- `--permission-mode` (e.g. acceptEdits / bypassPermissions) for fast paths

### A2R translation
- Replace “sandbox” with explicit `execution_mode`:
  - `PLAN_ONLY` (no tools)
  - `REQUIRE_APPROVAL` (ask / gating)
  - `ACCEPT_EDITS` (fast dev, but still through hooks/policy)
  - `BYPASS_PERMISSIONS` (YOLO; still runs hooks; intended only for isolated workspaces)

## 4) What A2R should add beyond Claude baseline

A2R extended tools (runner-native; do not assume Claude has them):
- KillProcess / KillShell (orchestrator-only)
- TaskOutput (read captured logs deterministically)
- AskUserQuestion (typed UI question tool)
- MCPSearch / MCP tool resolution (pinned by digest; no “best match”)

