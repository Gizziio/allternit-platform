import { createSignal, createMemo, Show, For } from "solid-js"
import { useTheme } from "@/cli/ui/tui/context/theme"
import { useDirectory } from "@/cli/ui/tui/context/directory"
import { RGBA, TextAttributes } from "@opentui/core"
import { useKeyboard } from "@opentui/solid"
import { GIZZIMascot } from "@/cli/ui/components/gizzi/mascot"
import { Flag } from "@/runtime/context/flag/flag"

export interface DiscretionaryScreenProps {
  onAccept: (action: "resume" | "code" | "cowork" | "new") => void
}

export function DiscretionaryScreen(props: DiscretionaryScreenProps) {
  const { theme } = useTheme()
  const directory = useDirectory()
  const [selectedIndex, setSelectedIndex] = createSignal(0)

  const accent = RGBA.fromInts(212, 176, 140)
  const accentBright = RGBA.fromInts(255, 220, 180)

  const options = [
    { id: "resume", label: "Resume Session", desc: "Continue your last active conversation", cmd: "/resume" },
    { id: "code", label: "Code Mode", desc: "Enter optimized environment for engineering", cmd: "code" },
    { id: "cowork", label: "Cowork Mode", desc: "Multi-agent collaborative workspace", cmd: "cowork" },
    { id: "new", label: "New Session", desc: "Start a fresh interaction", cmd: "/new" },
  ]

  useKeyboard((evt) => {
    if (evt.name === "up") {
      setSelectedIndex((i) => (i > 0 ? i - 1 : options.length - 1))
    } else if (evt.name === "down") {
      setSelectedIndex((i) => (i < options.length - 1 ? i + 1 : 0))
    } else if (evt.name === "return") {
      const selected = options[selectedIndex()]
      props.onAccept(selected.id as any)
    }
  })

  // Render authentic GIZZI mascot
  function renderGIZZI() {
    return (
      <box flexDirection="column" gap={0} marginBottom={2} alignItems="center">
        <GIZZIMascot state="pleased" compact={false} />
      </box>
    )
  }

  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width="100%"
      height="100%"
      padding={2}
    >
      {/* Authentic GIZZI mascot at the top */}
      {renderGIZZI()}

      {/* Welcome text */}
      <box marginBottom={2}>
        <text fg={accent} attributes={TextAttributes.BOLD}>Welcome to Gizzi Code</text>
      </box>

      <box
        borderStyle="single"
        borderColor={accent}
        paddingX={4}
        paddingY={2}
        flexDirection="column"
        alignItems="center"
        width={70}
      >
        <text attributes={TextAttributes.BOLD} fg={accent}>WORKSPACE ACCESS GRANTED</text>
        <box height={1} />
        <text fg={theme.text}>Project Root: {directory()}</text>
        <box height={1} />

        <box flexDirection="column" paddingX={2}>
          <text fg={theme.textMuted} wrapMode="word">
            Gizzi Code now has access to this directory. It can read,
            modify, and create files to assist with your engineering tasks.
          </text>
          <box height={1} />
          <text fg={theme.warning} attributes={TextAttributes.ITALIC}>
            ⚠ Always review destructive actions before confirming.
          </text>
        </box>

        {/* VM Session isolation notice */}
        <Show when={Flag.GIZZI_VM_SESSIONS}>
          <box height={1} />
          <box
            flexDirection="column"
            borderStyle="single"
            borderColor={RGBA.fromInts(100, 200, 120)}
            paddingX={2}
            paddingY={1}
          >
            <text fg={RGBA.fromInts(100, 200, 120)} attributes={TextAttributes.BOLD}>
              VM ISOLATION ACTIVE
            </text>
            <box height={1} />
            <text fg={theme.textMuted} wrapMode="word">
              Every agent session gets a dedicated Ubuntu 24.04 microVM.
              All bash commands run inside the VM — not on your host machine.
              Internet access is fully available inside the VM.
            </text>
            <box height={1} />
            <text fg={theme.textMuted}>
              Same toolset as Claude Code cloud sessions (Ubuntu 24.04):
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • Shells: bash, zsh/Powerlevel10k, fish  — bat, git-delta, fzf, fd, rg
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • Node 22 + nvm + npm/npx, Bun, pnpm, yarn  — JS/TS + MCP servers
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • Python 3 + uv + pip, uvicorn, Playwright/Chromium, Jupyter
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • Ruby 3.3.6 + rbenv + bundler + gem
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • Java OpenJDK 21 + Maven + Gradle
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • PHP 8 + Composer
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • Rust/cargo + clippy + rust-analyzer  — Go 1.23 + gopls  — clangd
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • TypeScript LS, pyright, prettier, eslint  — LSP tool ready
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • PostgreSQL 16 + Redis 7  — live databases on boot
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • gh CLI, Docker CLI, kubectl, Helm  — DevOps toolchain
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • ffmpeg, imagemagick, cmake, sqlite3, jq, git-lfs
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • Workspace: git clone → /workspace or VirtioFS bind-mount
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • Deps: bun/pnpm/npm install + cargo fetch + go mod + pip/poetry
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • SSH key forwarded from ~/.ssh/id_* for private repos
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • WebSearch: EXA_API_KEY + ca-certificates + full DNS/HTTPS
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • PreToolUse/PostToolUse: sh, jq, python3, node for hook scripts
            </text>
            <text fg={RGBA.fromInts(130, 200, 140)}>
              {" "}  • AskUserQuestion: GIZZI_SERVER_URL set to host gateway for callbacks
            </text>
            <box height={1} />
            <text fg={theme.textMuted}>
              API: {Flag.GIZZI_VM_API_URL ?? "⚠ GIZZI_VM_API_URL not set — will run in local fallback"}
            </text>
            <text fg={theme.textMuted} attributes={TextAttributes.ITALIC}>
              Use /vm to toggle VM isolation per-session.
            </text>
          </box>
        </Show>

        {/* Sandbox notice (bwrap / sandbox-exec, when VM is not active) */}
        <Show when={Flag.GIZZI_SANDBOX && !Flag.GIZZI_VM_SESSIONS}>
          <box height={1} />
          <box
            flexDirection="column"
            borderStyle="single"
            borderColor={RGBA.fromInts(200, 180, 100)}
            paddingX={2}
            paddingY={1}
          >
            <text fg={RGBA.fromInts(200, 180, 100)} attributes={TextAttributes.BOLD}>
              SUBPROCESS SANDBOX ACTIVE
            </text>
            <box height={1} />
            <text fg={theme.textMuted} wrapMode="word">
              Bash subprocesses are wrapped in OS-level isolation
              ({process.platform === "linux" ? "bwrap" : "sandbox-exec"}).
              The project directory is shared read-write; all other paths
              are read-only or blocked.
            </text>
            <text fg={theme.textMuted} attributes={TextAttributes.ITALIC}>
              Use /sandbox to toggle per-session.
            </text>
          </box>
        </Show>
      </box>

      <box height={2} />

      {/* Selection options */}
      <box flexDirection="column" gap={0} width={70}>
        <For each={options}>
          {(option, i) => {
            const isSelected = createMemo(() => i() === selectedIndex())
            return (
              <box
                paddingX={2}
                paddingY={1}
                backgroundColor={isSelected() ? accent : undefined}
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
              >
                <box flexDirection="column" gap={0}>
                  <text
                    fg={isSelected() ? RGBA.fromInts(26, 26, 26) : theme.text}
                    attributes={isSelected() ? TextAttributes.BOLD : undefined}
                  >
                    {option.label}
                  </text>
                  <Show when={isSelected()}>
                    <text fg={RGBA.fromInts(60, 60, 60)}>
                      {option.desc}
                    </text>
                  </Show>
                </box>
                <text fg={isSelected() ? RGBA.fromInts(26, 26, 26) : theme.textMuted}>
                  {option.cmd}
                </text>
              </box>
            )
          }}
        </For>
      </box>

      <box height={3} />
      <text fg={theme.textMuted}>↑↓ Arrow keys to select · ENTER to confirm</text>
    </box>
  )
}
