# Commands

ChatGPT and Codex commands provide fast navigation, session actions, settings, and links into a running client. Allternit exposes the same concepts through `gizzi-code` slash commands, configurable TUI keybindings, CLI flags, and guarded URI handlers.

## Keyboard shortcuts

The default TUI bindings include:

| Action | Default |
| --- | --- |
| Interrupt current work | `Ctrl+C` |
| Exit | `Ctrl+D` |
| Redraw | `Ctrl+L` |
| Search prompt history | `Ctrl+R` |
| Toggle transcript | `Ctrl+O` |
| Submit | `Enter` |
| Cycle interaction mode | `Shift+Tab` (platform-dependent fallback on Windows) |
| Open external editor | `Ctrl+X Ctrl+E` or `Ctrl+G` |

Bindings are context-sensitive and configurable. Inspect the effective set with:

```bash
gizzi config keybinds
```

Override supported actions in `config.toml`:

```toml
[keybinds]
terminal_title_toggle = "ctrl+t"
tips_toggle = "<leader>h"
display_thinking = "ctrl+o"
display_runtime_trace = "ctrl+r"
```

`Ctrl+C` and `Ctrl+D` have reserved safety behavior and cannot be rebound.

## Search past chats and find in a chat

- Run `/resume` to browse local sessions; type `/` in the picker to search titles, metadata, tags, and available transcript content.
- Start with `gizzi --resume search-term` to open the picker with a search term.
- Use `/tag name` to add searchable session metadata.
- Use the in-chat search action to search all messages in the current session and jump among matches.
- Press `Ctrl+R` in the prompt editor to search previously submitted prompts.

Local transcripts live under `$GIZZI_HOME/projects`; platform sessions are separate server-managed records. See [history persistence](../cli/history-persistence.md).

## Settings

Use `gizzi config` for durable settings and CLI flags for a single invocation:

```bash
gizzi config list --sources
gizzi config keybinds
gizzi --model anthropic/claude-4 --permission-mode ask
```

Configuration is layered across user, project, inline, and managed sources. Managed configuration has higher precedence than user/project files; supported one-off CLI flags have the final runtime precedence. See [advanced configuration](../cli/advanced-configuration.md) and [config locations](../cli/config-locations.md).

## Deep links

The desktop/terminal bridge implements the guarded `claude-cli://open` compatibility scheme:

```text
claude-cli://open
claude-cli://open?q=review%20the%20tests
claude-cli://open?cwd=/absolute/path/to/project&q=explain%20this%20repo
claude-cli://open?repo=owner/repository&q=review%20the%20latest%20change
```

Only the `open` action is supported. Parameters are optional:

| Parameter | Meaning |
| --- | --- |
| `q` | Prefill the editor; it is not automatically submitted. |
| `cwd` | Open an absolute local directory. |
| `repo` | Resolve a validated `owner/repository` slug through configured repository paths. |

The parser rejects unknown actions, relative working directories, invalid repository slugs, control characters, and oversized values. A provenance warning is displayed for externally opened sessions so the user can review the prompt before submission.

Remote-runtime links use `cc://` or `cc+unix://` internally, and server-backed session URLs may identify an existing remote session. These are transport links, not general web URL handlers.

## Supported links

Allternit distinguishes links by purpose:

- `https://` and `http://` are ordinary documentation or web links and may be fetched/opened subject to tool and network policy.
- `claude-cli://open` launches a local prompt/cwd/repository handoff through the compatibility handler.
- `cc://` and `cc+unix://` connect the CLI to an Allternit-compatible runtime transport.
- `file://` is used internally for explicit `--file` attachments; external deep links cannot use it to bypass workspace validation.

## See also

- [CLI customization](../cli/cli-customization.md)
- [Advanced configuration](../cli/advanced-configuration.md)
- [History persistence](../cli/history-persistence.md)
- [Sessions API](../api/sessions.md)

