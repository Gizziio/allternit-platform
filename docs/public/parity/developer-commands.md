# Developer commands

ChatGPT and Codex developer commands are interactive shortcuts for inspecting and
controlling a coding session. In Allternit, the equivalent surface is
`gizzi-code`: enter `/` in an interactive session to open the command palette,
then type a command and any arguments. The palette is the authoritative list for
the installed build because plugins and skills can contribute additional commands.

This reference separates exact `gizzi-code` commands from platform API or CLI
workflows and from concepts that are not currently applicable. Examples use
`gizzi`; packaged builds may expose the same binary as `gizzi-code`.

## Command overview

| Codex concept | Allternit equivalent |
| --- | --- |
| Archive the current session with `/archive` | No local `/archive`. For platform beta sessions, `DELETE /api/v1/beta/sessions/:id` is a non-destructive archive. The regular agent-session API also supports permanent deletion. |
| Ask for a working tree review with `/review` | `/review [PR-number]` performs a local PR review using `gh pr view` and `gh pr diff`. `/diff` shows uncommitted and per-turn changes. |
| Assign a key binding | Supported through the user keybinding file and command actions. See **Key bindings** below. |
| Browse apps with `/apps` | No `/apps` command. Browse the catalog with `GET /api/v1/connectors`; MCP-backed app actions appear in the tool catalog. This remains a web/desktop/API workflow. |
| Browse plugins with `/plugins` | `/plugins` (also `/marketplace`) opens the plugin marketplace. The non-interactive equivalents are `gizzi plugin list`, `gizzi plugin install`, and related subcommands. |
| Check background terminals with `/ps` | No `/ps` command. Managed work is inspected with the work queue or Cowork session APIs/CLI; ordinary shell jobs remain owned by the user's shell or tmux. |
| Choose a syntax theme with `/theme` | `/theme` opens the theme picker. |
| Choose a terminal pet with `/pets` | **Not applicable / roadmap.** Allternit has no terminal-pet feature; this is cosmetic and not required by the self-host/BYOC runtime. |
| Clear the terminal and start a new chat with `/clear` | `/clear`, `/reset`, and `/new` clear conversation history and free context. The main-screen palette also exposes New session. |
| Configure footer items with `/statusline` | `/statusline [request]` invokes the status-line setup agent. |
| Configure memories with `/memories` | Use `/memory` to view or edit workspace memory and `/forget` to clear it. Workspace memory lives at `.gizzi/L1-COGNITIVE/memory/MEMORY.md`; the platform also exposes `/api/v1/memory` routes. |
| Configure terminal title items with `/title` | There is no interactive `/title` configurator. Use `gizzi --name "display name"`; the name is shown in `/resume` and the terminal title. Automatic terminal-title updates are built into the runtime. |
| Copy the latest response with `/copy` | `/copy` copies the latest response; `/copy N` selects the Nth-latest response. The session palette also has transcript copy/export actions. |
| Delete the current session with `/delete` | No in-session `/delete`. Delete from the session picker, or call `DELETE /api/v1/agent-sessions/:id`. This is permanent; the beta-session DELETE route archives instead. |
| Exit the CLI with `/quit` or `/exit` | `/exit` and `/quit` exit the REPL. |
| Fork the current chat with `/fork` | `/fork` opens the timeline and creates a child from a selected message. At launch, `gizzi --resume ID --fork-session` provides the same workflow. |
| Grant sandbox read access with `/sandbox-add-read-dir` | Use `gizzi --add-dir PATH...` for the launch, or define scoped `Read(...)` permission rules. No command can silently broaden an already-running sandbox. |
| Highlight files with `/mention` | Type `@` and select a file, or use the Files palette entry. There is no separate `/mention` command. |
| Include IDE context with `/ide` | `/ide` manages IDE integration; `/ide open` opens the connected IDE. `gizzi --ide` connects on startup when exactly one integration is available. |
| Inspect config layers with `/debug-config` | `/config` displays the effective project config. `gizzi --settings FILE_OR_JSON` and `--setting-sources user,project,local` make layers explicit. There is no command named `/debug-config`. |
| Inspect the session with `/status` | `/status` shows version, model, account, API connectivity, and tool status. `/usage` adds token, context-window, and cost information. |
| Keep transcripts lean with `/compact` | `/compact [instructions]` summarizes earlier context. The API equivalent is `POST /api/v1/agent-sessions/:id/compact`. |
| List MCP tools with `/mcp` | `/mcp` manages MCP servers and their connection state; `/mcps` opens the management dialog. Use the MCP `tools/list` method for the exact server-side tool list. |
| Remap TUI shortcuts with `/keymap` | Keymaps are configurable, but there is no `/keymap` editor. Edit the user keybinding file and restart/reload the client. |
| Rename the current chat with `/rename` | `/rename` updates the session title. `gizzi --name NAME` sets it at creation time; `PATCH /api/v1/agent-sessions/:id` is the platform workflow. |
| Resume a saved chat with `/resume` | `/resume [ID or search]` opens a saved conversation. CLI equivalents are `gizzi --resume [ID]` and `gizzi --continue`. |
| Review changes with `/diff` | `/diff` shows uncommitted and per-turn diffs. It does not stage, commit, or push. |
| Send feedback with `/feedback` | `/feedback [report]` (alias `/bug`) opens the feedback flow when product-feedback traffic is enabled by policy. Self-hosted operators can instead use their configured issue tracker. |
| Set a communication style with `/personality` | No `/personality` command. Per-user response style is stored through `GET`/`PUT /api/v1/agent-preferences`; agent definitions and system prompts provide session-specific style. |
| Set or view a task goal with `/goal` | `/goal OBJECTIVE` creates a durable goal; `/goal status`, `pause`, `resume`, `complete`, and `block` manage it. `/goal queue ...` and `/goal replace ...` control an existing active goal. |
| Set up the elevated Windows sandbox with `/setup-default-sandbox` | **Not applicable / roadmap.** Allternit uses host, container, VM, SSH, and Cowork permission profiles rather than Codex's Windows-specific elevated sandbox bootstrap. |
| Sign out with `/logout` | `/logout` signs out; `gizzi auth logout` is the non-interactive equivalent. BYOC provider credentials remain under operator control. |
| Start a new chat with `/new` | `/new` is an alias of `/clear`; the session palette can also create a separate new session. |
| Start a side chat with `/side` | **Roadmap.** There is no `/side` command. `/fork` creates a durable branch, while agent swarms/subagents provide parallel delegated threads. |
| Stop background terminals with `/stop` | No general `/stop` command. Stop managed work with `POST /api/v1/beta/work/:id/stop`, abort a session with `POST /api/v1/agent-sessions/:id/abort`, or use the Cowork stop/delete workflow. Shell jobs remain under shell/tmux control. |
| Switch agent threads with `/agent` | No direct `/agent` thread switcher in the TUI. The palette exposes the agent swarm tree, and `gizzi --agent NAME` selects an agent at launch. Use the session list to switch durable sessions. |
| Switch to plan mode with `/plan` | `/plan`, `/plan open`, or `/plan DESCRIPTION` enables or displays the current session plan. |
| Toggle Fast mode with `/fast` | `/fast [on|off]` exists when the selected provider/model exposes fast mode. Availability is intentionally provider-dependent. |
| Toggle Vim mode with `/vim` | `/vim` switches between normal and Vim input/navigation modes. |
| Toggle experimental features with `/experimental` | No single `/experimental` command. Feature gates are deployment/build configuration so self-hosted operators can promote features deliberately. Treat individual experimental flags as unstable. |
| Toggle raw scrollback with `/raw` | **Roadmap.** The TUI has transcript export, thinking/runtime-trace toggles, and native terminal scroll handling, but no `/raw` compatibility toggle. |
| Update permissions with `/permissions` | `/permissions` manages allow/deny tool rules. Launch flags include `--permission-mode`, `--allowed-tools`, `--disallowed-tools`, and `--tools`. |
| View account usage with `/usage` | `/usage` shows token usage, context window, and session cost. In BYOC deployments, provider billing remains authoritative. |
| View and manage lifecycle hooks with `/hooks` | `/hooks` displays hook configuration and tool-event lifecycle hooks. Hooks are configured in the normal Gizzi config layers or contributed by plugins. |

## Using slash commands

Type `/` to open fuzzy completion, continue typing to filter, then press Enter.
Arguments follow the command name:

```text
/review 482
/copy 2
/goal queue Audit the authentication boundary
/mcp enable docs
/compact Preserve API decisions and unresolved risks
```

Commands are contextual. A command can be hidden when its provider, policy,
feature gate, or interactive-only requirement is unavailable. `/help` and the
command palette show the commands active in the current build. Plugin commands
and skills use the same `/name arguments` form.

## Key bindings and interactive shortcuts

Allternit's TUI maps named actions such as `session_fork`, `session_rename`,
`session_delete`, `show_help`, `view_usage`, and `command:<name>` to shortcuts.
User bindings in `~/.claude/keybindings.json` are merged over defaults and
hot-reloaded. Start from the shipped template and use command actions to bind a
slash command:

```json
{
  "$schema": "https://www.schemastore.org/gizzi-keybindings.json",
  "bindings": [
    {
      "context": "Chat",
      "bindings": {
        "ctrl+shift+f": "session_fork",
        "ctrl+g d": "command:diff",
        "ctrl+g c": "command:compact"
      }
    }
  ]
}
```

Use the keybinding help dialog to confirm the active mapping and avoid terminal
reserved combinations. A two-key chord such as `ctrl+g d` is safer than
overriding common shell editing keys. `/vim` changes editing/navigation behavior
but does not replace the configured action map.

File context is interactive too: type `@` for file completion, use the file and
message search palette entries, and use `/ide` when editor selection/context is
needed.

## Global flags

Run `gizzi --help` for the build's complete list. The most useful groups are:

| Purpose | Flags |
| --- | --- |
| Automation | `-p, --print`, `--input-format`, `--output-format`, `--json-schema`, `--max-turns`, `--max-budget-usd` |
| Conversation lifecycle | `--continue`, `--resume [ID]`, `--fork-session`, `--session-id UUID`, `--name NAME`, `--no-session-persistence` |
| Model and agent | `--model`, `--effort`, `--agent`, `--fallback-model` |
| Instructions and context | `--system-prompt`, `--system-prompt-file`, `--append-system-prompt`, `--append-system-prompt-file`, `--add-dir`, `--ide` |
| Tools and MCP | `--tools`, `--allowed-tools`, `--disallowed-tools`, `--mcp-config`, `--strict-mcp-config` |
| Configuration | `--settings`, `--setting-sources`, `--plugin-dir`, `--disable-slash-commands` |
| Isolation | `--permission-mode`, `--worktree [name]`, `--no-worktree`, `--tmux` |
| Diagnostics | `--debug [filter]`, `--debug-file`, `--verbose` |

Example headless review with bounded tools and structured output:

```bash
gizzi --print \
  --model sonnet \
  --max-turns 8 \
  --tools Read Grep Glob Bash \
  --allowed-tools 'Bash(git diff:*)' 'Bash(git status:*)' \
  --output-format json \
  'Review the working tree and report correctness risks.'
```

Resume into an isolated branch of a conversation:

```bash
gizzi --resume 550e8400-e29b-41d4-a716-446655440000 \
  --fork-session \
  --worktree review-fix \
  --name 'Review follow-up'
```

## API workflows

Allternit's self-host/BYOC model makes lifecycle operations available over HTTP
instead of requiring a hosted-product-only slash command.

Archive a beta session without erasing its record:

```bash
curl -X DELETE "$ALLTERNIT_API/api/v1/beta/sessions/$SESSION_ID" \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN"
```

Compact, abort, or permanently delete a regular agent session:

```bash
curl -X POST "$ALLTERNIT_API/api/v1/agent-sessions/$SESSION_ID/compact" \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN"

curl -X POST "$ALLTERNIT_API/api/v1/agent-sessions/$SESSION_ID/abort" \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN"

curl -X DELETE "$ALLTERNIT_API/api/v1/agent-sessions/$SESSION_ID" \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN"
```

List server-side MCP tools directly:

```bash
curl -X POST "$ALLTERNIT_API/mcp/server" \
  -H "Authorization: Bearer $ALLTERNIT_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Permanent deletion and permission bypass deserve special care. Prefer archive
when retention is acceptable; inspect the session ID before DELETE. Never combine
`--dangerously-skip-permissions` with an internet-connected, credentialed, or
host-mounted runtime. Prefer a narrow permission mode, explicit tool allowlists,
and `--add-dir` over broad filesystem access. `--strict-mcp-config` is useful in
automation because it prevents ambient user/project MCP servers from joining the
run.

## Related resources

- [History persistence](../cli/history-persistence.md)
- [Permission profiles](../cli/permission-profiles.md)
- [Agent approvals and security](../cli/agent-approvals-security.md)
- [MCP integration](../tools/mcp.md)
- [Strict tool use](../tools/strict-tool-use.md)
- [Work queue API](../api/work-queue.md)
- [Agent lifecycle](../guides/agent-lifecycle.md)
