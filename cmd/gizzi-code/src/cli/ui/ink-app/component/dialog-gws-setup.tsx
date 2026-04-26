/**
 * Dialog: Google Workspace CLI Setup
 *
 * Guides user through installing and configuring the `gws` CLI
 * (@googleworkspace/cli) so that its 100+ SKILL.md files are
 * auto-discovered from ~/.openclaw/skills/.
 *
 * Keys:
 *   Enter  proceed / confirm
 *   Esc    close
 */
import { createSignal, Show, For } from "solid-js"
import { useDialog } from "@/cli/ui/ink-app/ui/dialog"
import { useTheme } from "@/cli/ui/ink-app/context/theme"
import { useKeyboard } from "@opentui/solid"

type Step =
  | "check"       // detecting gws CLI
  | "install"     // offer install instructions
  | "auth"        // show auth instructions
  | "skills"      // confirm skill discovery
  | "done"        // setup complete

export function DialogGwsSetup() {
  const dialog = useDialog()
  const { theme } = useTheme()

  const [step, setStep] = createSignal<Step>("check")
  const [gwsFound, setGwsFound] = createSignal<boolean | null>(null)
  const [skillCount, setSkillCount] = createSignal<number | null>(null)
  const [statusMsg, setStatusMsg] = createSignal("")

  const showStatus = (msg: string, ttl = 3000) => {
    setStatusMsg(msg)
    setTimeout(() => setStatusMsg(""), ttl)
  }

  // Auto-detect on mount
  const detect = async () => {
    setStep("check")
    try {
      const res = await fetch("/v1/skill/")
      const skills = (await res.json()) as Array<{ name: string; location: string }>
      const gwsSkills = skills.filter((s) => s.location.includes(".openclaw"))
      setSkillCount(gwsSkills.length)

      // Check if gws binary exists via shell route or just check path
      const binRes = await fetch("/v1/path/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: "which gws" }),
      }).catch(() => null)

      const found = binRes?.ok ?? gwsSkills.length > 0
      setGwsFound(found)
      setStep(found ? (gwsSkills.length > 0 ? "done" : "auth") : "install")
    } catch {
      setGwsFound(false)
      setStep("install")
    }
  }

  void detect()

  useKeyboard((evt) => {
    if (evt.name === "escape") {
      evt.preventDefault()
      dialog.clear()
    }
    if (evt.name === "return") {
      evt.preventDefault()
      const s = step()
      if (s === "install") setStep("auth")
      else if (s === "auth") { void detect() }
      else if (s === "done") dialog.clear()
    }
  })

  const installCommands = [
    "npm install -g @googleworkspace/cli",
    "# or: npx @googleworkspace/cli",
  ]

  const authSteps = [
    "1. Run: gws auth login",
    "2. Follow browser OAuth prompt",
    "3. Authorize the requested Google scopes",
    "4. Skills will appear in ~/.openclaw/skills/",
  ]

  return (
    <box
      flexDirection="column"
      width={80}
      maxHeight={30}
      padding={1}
      backgroundColor={theme.backgroundPanel}
      borderStyle="single"
      borderColor={theme.border}
    >
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" marginBottom={1}>
        <text fg={theme.text}>Google Workspace CLI Setup</text>
        <text fg={theme.textMuted}>Esc close</text>
      </box>

      <Show when={statusMsg()}>
        <text fg={theme.warning} marginBottom={1}>{statusMsg()}</text>
      </Show>

      {/* Check step */}
      <Show when={step() === "check"}>
        <text fg={theme.textMuted}>Detecting gws CLI…</text>
      </Show>

      {/* Install step */}
      <Show when={step() === "install"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.warning}>gws CLI not detected</text>
          <text fg={theme.text}>
            The Google Workspace CLI (@googleworkspace/cli) ships 100+ SKILL.md
            files that gizzi-code discovers automatically from ~/.openclaw/skills/.
          </text>
          <text fg={theme.textMuted} marginTop={1}>Install command:</text>
          <For each={installCommands}>
            {(cmd) => <text fg={theme.accent}>{cmd}</text>}
          </For>
          <text fg={theme.textMuted} marginTop={1}>
            After installing, press Enter to continue to auth →
          </text>
        </box>
      </Show>

      {/* Auth step */}
      <Show when={step() === "auth"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.text}>Authenticate with Google Workspace</text>
          <text fg={theme.textMuted}>
            gws needs Google account access to enable skills like Gmail, Calendar,
            Drive, Docs, Sheets, and more.
          </text>
          <box flexDirection="column" marginTop={1} gap={1}>
            <For each={authSteps}>
              {(s) => <text fg={theme.text}>{s}</text>}
            </For>
          </box>
          <text fg={theme.textMuted} marginTop={1}>
            Press Enter to re-check skill discovery after authing →
          </text>
        </box>
      </Show>

      {/* Done step */}
      <Show when={step() === "done"}>
        <box flexDirection="column" gap={1}>
          <text fg={theme.success}>Google Workspace CLI is set up!</text>
          <Show when={skillCount() !== null}>
            <text fg={theme.text}>
              {skillCount()} gws skill{skillCount() !== 1 ? "s" : ""} discovered in ~/.openclaw/skills/
            </text>
          </Show>
          <text fg={theme.textMuted} marginTop={1}>
            Skills are available as /slash commands in any session.
          </text>
          <text fg={theme.textMuted}>
            Example: /gmail-read, /gcal-create, /gdocs-summarize
          </text>
          <text fg={theme.textMuted} marginTop={1}>Press Enter to close.</text>
        </box>
      </Show>

      {/* Footer nav hint */}
      <box flexDirection="row" gap={2} marginTop={1}>
        <Show when={step() === "install" || step() === "auth"}>
          <text fg={theme.textMuted}>Enter next</text>
        </Show>
        <Show when={step() === "done"}>
          <text fg={theme.textMuted}>Enter close</text>
        </Show>
        <text fg={theme.textMuted}>Esc cancel</text>
      </box>
    </box>
  )
}
