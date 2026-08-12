# ChatGPT desktop app for Windows parity

The ChatGPT Windows app documents a native Windows GUI, Windows sandbox behavior, editor integration, and WSL interoperability. Allternit's current developer workflow is CLI/web based and Unix-first. Run `gizzi` inside WSL for Linux repositories; a feature-complete native Windows desktop shell is **Not applicable / roadmap**.

## Customize for your dev setup

Configuration is layered across the user, project, managed, environment, and CLI sources. On native Windows, the default state root is `%USERPROFILE%\.gizzi`; inside WSL it follows Linux/XDG paths.

```toml
# .gizzi/config.toml
default_model = "allternit-balanced"
instructions = ["AGENTS.md"]

[sandbox]
mode = "workspace-write"

[approval_policy]
mode = "ask"
```

Inspect what was loaded with `gizzi config path`, `gizzi config list --sources`, and `gizzi config show`.

## Git features are unavailable

There is no separate Windows-app Git panel to enable or disable. `gizzi` invokes the `git` installed in its execution environment. Run `git --version` and `git status` in the same WSL shell before starting `gizzi`. Git-aware workspace boundaries are supported when the project is a Git worktree.

## Git isn't detected for projects opened from `\\wsl$`

**Not applicable / roadmap.** Allternit does not currently provide a native Windows project picker with `\\wsl$` Git discovery. Open the repository from inside WSL and launch the CLI there:

```bash
cd ~/src/my-project
git status
gizzi
```

Avoid doing Linux development through a Windows UNC working directory; it can also create path, watcher, permission, and performance differences unrelated to Allternit.

## Local environment scripts on Windows

Allternit has no Windows-desktop-specific environment-script field. Use ordinary PowerShell/WSL profile scripts, project scripts, environment variables, project instructions, or skill/plugin hooks. For portable automation, put the workflow in a skill and invoke it from the project.

```powershell
$env:GIZZI_CONFIG = "$PWD\.gizzi\config.toml"
gizzi exec "run the repository verification workflow"
```

## Native sandbox

Allternit exposes `read-only`, `workspace-write`, and `danger-full-access` policy presets plus VM-backed sandbox APIs. Native Windows OS sandbox parity is **roadmap**; current isolation should run inside WSL/Linux or a configured WebVM/VM driver.

```toml
[sandbox]
mode = "workspace-write"
allow_network = false
allowed_domains = ["api.github.com"]
```

## PowerShell execution policy blocks commands

PowerShell policy is owned by Windows, not bypassed by Allternit. Prefer the WSL installation. For a native installation, inspect `Get-ExecutionPolicy -List`, use signed scripts, and ask an administrator to apply the least-permissive policy appropriate for the organization. Do not disable policy globally just to run an agent.

## Preferred editor

The TUI can open the external editor selected by `VISUAL` or `EDITOR` (default binding `Ctrl+X Ctrl+E` or `Ctrl+G`). Set it before launching:

```powershell
$env:VISUAL = "code --wait"
gizzi
```

This edits prompts; Allternit does not maintain a separate Windows-app editor picker.

## Run commands with elevated permissions

Allternit intentionally does not self-elevate. Start a trusted shell as Administrator only when the task genuinely requires it, or approve a narrowly scoped operation. `--dangerously-skip-permissions` and full-access sandbox modes are not elevation mechanisms and should be limited to disposable, isolated environments.

## Share config, auth, and sessions with WSL

Windows and WSL use different default homes. Sharing is opt-in by pointing both processes at a directory visible to both:

```powershell
$env:GIZZI_HOME = "C:\Users\alice\.gizzi"
```

```bash
export GIZZI_HOME=/mnt/c/Users/alice/.gizzi
```

File-backed credentials can then be shared, but OS-keychain entries cannot. Concurrent use of one session/state directory is not guaranteed; prefer separate homes and copy only `config.toml` or shared skills when possible.

## Windows Subsystem for Linux (WSL)

WSL is the recommended Windows developer environment. Install the Linux build inside the distribution, keep repositories in the Linux filesystem, and run the agent from the repository directory. See [WSL parity](./wsl.md).

## `Cmder` isn't listed in the open dialog

**Not applicable / roadmap.** Allternit has no native Windows terminal-open dialog or maintained list of terminal applications. Start `gizzi` directly from Cmder if its shell can execute the installed binary, or use Windows Terminal with a WSL profile.

## Useful developer tools

Useful companions are Git for the environment where `gizzi` runs, Windows Terminal, WSL, VS Code with Remote - WSL, and a container/VM backend when stronger isolation is needed. Allternit also supplies the Native Tool Belt, MCP integration, skills, plugins, and persistent PTY terminals.

## Troubleshooting and FAQ

1. Run `gizzi config path` and `gizzi config list --sources` to detect Windows/WSL home mismatches.
2. Run `which gizzi`, `which git`, and `git status` inside WSL.
3. Keep the repository under `~/src`, not `/mnt/c` or `\\wsl$`, for Linux toolchains.
4. Check `GIZZI_HOME`, `GIZZI_CONFIG`, `VISUAL`, and `EDITOR` in the same shell that starts `gizzi`.
5. Treat native Windows sandboxing, UNC project discovery, and desktop terminal selection as roadmap items.

See [config and state locations](../cli/config-locations.md) and [agent approvals and security](../cli/agent-approvals-security.md).
