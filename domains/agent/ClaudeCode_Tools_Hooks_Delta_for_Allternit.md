# Claude Code → Allternit Tool & Hook Delta (Additions to Locked Baseline)

<SECTION id="meta">
---
doc: "Delta for tool/hook surface based on Claude Code docs"
sources:
  - "Hooks reference (events, matchers, MCP tool naming)"
  - "Claude Code settings (permission rules, defaultMode, directories)"
status: additive
allternit_action: "Extend Allternit HookRuntime + PolicyEngine + ToolRegistry to cover Claude Code semantics without coupling to Claude"
---
</SECTION>

<SECTION id="hooks_events">
## Hook lifecycle events to support (Claude parity baseline)

Claude Code defines these hook events and when they fire: SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Notification, SubagentStart, SubagentStop, Stop, TeammateIdle, TaskCompleted, PreCompact, SessionEnd. citeturn4view0

### Allternit mapping rule (locked)
- Treat these as **kernel boundary stages** around tool execution and agent lifecycle.
- Allternit MUST be able to emit equivalent events in its own observability stream even when not using Claude.

### Matcher semantics you should copy
- Tool events match on `tool_name` (regex).
- SessionStart matches on start reason (`startup|resume|clear|compact`).
- SessionEnd matches on end reason (`clear|logout|prompt_input_exit|...`). citeturn4view0

### MCP tool naming pattern (important for deterministic allow/deny)
- MCP tools appear with names like `mcp__<server>__<tool>` and can be matched with regex. citeturn4view0
</SECTION>

<SECTION id="permissions">
## Permission model semantics to import

Claude Code settings supports:
- `permissions.allow|ask|deny` rules (tool-level and tool-with-specifier rules, e.g., `Read(./secrets/**)` and `Bash(git diff:*)`). citeturn5search0turn5search6
- `additionalDirectories` to extend the working set. citeturn5search0turn5search1
- `defaultMode` permission modes: `default`, `acceptEdits`, `plan`, `bypassPermissions`. citeturn5search1turn5search6
- a managed-policy kill-switch for bypass mode (`disableBypassPermissionsMode`). citeturn5search0

### Allternit lock
- WIH scope remains highest authority (narrowest).
- Map `bypassPermissions` to your explicit execution flag (“dangerously skip permissions”) and allow org-level disable.

</SECTION>

<SECTION id="tool_surface">
## Tool surface: what Claude docs concretely expose via hooks/permissions

The hooks docs and settings docs concretely reference these tool identifiers in matchers and permission rules:
- `Bash`, `Edit`, `Write`, `Read` and tool group matchers like `Edit|Write`, plus `Notebook.*` patterns. citeturn4view0turn5search0

### Allternit action
- Keep your previously-locked “Claude parity baseline list” as the ToolRegistry baseline.
- Add/lock **tool naming** and **specifier pattern support** exactly as in Claude permissions:
  - `Tool`
  - `Tool(specifier)` where specifier is tool-specific (e.g., Bash “command prefix”, Read path patterns). citeturn5search0turn5search6
- Add **MCP tool IDs** as first-class ToolRegistry entries under the `mcp__*` naming scheme, with version pinning in WIH.
</SECTION>

<SECTION id="async_hooks">
## Async hooks (optional but high leverage)

Claude supports async hooks and background execution for certain automation flows. citeturn4view0

Allternit mapping:
- Allow hook handlers to be executed async **only** if:
  - they cannot mutate durable state directly
  - their outputs are emitted as receipts/events and then reconciled via Rails gate
</SECTION>
