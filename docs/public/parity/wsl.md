# WSL parity

Windows Subsystem for Linux (WSL) lets Windows users run a Linux toolchain and keep development work inside a Linux filesystem. For Allternit, WSL is the recommended way to run the Unix-first `gizzi` CLI on Windows; it is not a special remote Allternit runtime.

## Work on code inside WSL

Install and run `gizzi`, Git, and project dependencies inside the same WSL distribution. Keep repositories under the Linux home directory for consistent permissions and filesystem performance:

```bash
mkdir -p ~/src
cd ~/src
git clone https://github.com/example/project.git
cd project
gizzi
```

The active project root, sandbox boundary, shell commands, configuration, and Git executable are then all Linux-side. Do not open a `\\wsl$` path in a native Windows process and expect it to share the same execution environment.

## Confirm you're connected to WSL

From the terminal that will launch Allternit:

```bash
test -n "$WSL_DISTRO_NAME" && echo "WSL: $WSL_DISTRO_NAME"
uname -a
which gizzi
which git
gizzi config path
```

Expected paths are Linux paths such as `/home/alice/...`, not `C:\...`. `gizzi config path` may use `~/.gizzi` or the configured XDG directory.

## Launch VS Code from inside WSL

Install VS Code's Remote - WSL support on Windows, then from the repository's WSL directory run:

```bash
code .
```

VS Code should show the WSL distribution in its remote indicator and open a Linux-integrated terminal. Start `gizzi` from that terminal to preserve the same working directory, Git, environment variables, and toolchain.

## Open VS Code from a WSL terminal

This is the same `code .` workflow; it belongs to VS Code rather than Allternit. If `code` is missing, install/enable the VS Code WSL shell command and retry from WSL. Allternit has no separate “Open VS Code in WSL” command.

To share only selected configuration with native Windows, see [Windows desktop parity](./chatgpt-desktop-app-for-windows.md#share-config-auth-and-sessions-with-wsl). Separate state roots are safer than concurrent access to one sessions directory.
