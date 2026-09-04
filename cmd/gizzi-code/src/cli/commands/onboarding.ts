import * as prompts from "@clack/prompts"
import path from "path"
import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { Global } from "@/runtime/context/global"
import {
  getAuthStatus,
  loginApiKey,
} from "@/runtime/context/config/auth-profiles"
import {
  markTelemetryNoticeShown,
  setTelemetryEnabled,
} from "@/shared/utils/telemetrySettings"
import { loadPreferences, savePreferences } from "../../utils/sessionStorage.js"

export const ONBOARDING_MARKER_FILE = "onboarding-complete"

export function onboardingMarkerPath(stateDir: string = Global.Path.state): string {
  return path.join(stateDir, ONBOARDING_MARKER_FILE)
}

export function configTomlPath(): string {
  return path.join(Global.Path.config, "config.toml")
}

export type OnboardingDeps = {
  /** stdin is a TTY and prompts can be shown. */
  interactive: boolean
  /** CI/non-interactive environment detected. */
  isCI: boolean
  /** Directory holding the never-nag-again marker. */
  stateDir: string
  /** Path to config.toml — its absence is part of the first-run signal. */
  configToml: string
  /** True when an auth method is already configured. */
  authConfigured: () => Promise<boolean>
  exists: (p: string) => Promise<boolean>
  writeFile: (p: string, contents: string) => Promise<void>
}

export async function defaultOnboardingDeps(): Promise<OnboardingDeps> {
  const fs = await import("fs/promises")
  return {
    interactive: process.stdin.isTTY === true,
    isCI: (process.env.CI ?? "") !== "",
    stateDir: Global.Path.state,
    configToml: configTomlPath(),
    authConfigured: async () => {
      try {
        const status = await getAuthStatus(configTomlPath())
        return status.method !== "none"
      } catch {
        return false
      }
    },
    exists: async (p) => {
      try {
        await fs.access(p)
        return true
      } catch {
        return false
      }
    },
    writeFile: async (p, contents) => {
      await fs.mkdir(path.dirname(p), { recursive: true })
      await fs.writeFile(p, contents)
    },
  }
}

/**
 * True when the first interactive launch should auto-run the onboarding
 * wizard: interactive, not CI, never completed, no config.toml, and no auth
 * configured. Checked once per launch; the wizard sets the marker on
 * completion so it never nags again.
 */
export async function shouldOfferFirstRunOnboarding(
  deps: Pick<OnboardingDeps, "interactive" | "isCI" | "stateDir" | "configToml" | "authConfigured" | "exists">,
): Promise<boolean> {
  if (!deps.interactive || deps.isCI) return false
  if (await deps.exists(onboardingMarkerPath(deps.stateDir))) return false
  if (await deps.exists(deps.configToml)) return false
  if (await deps.authConfigured()) return false
  return true
}

export async function markOnboardingComplete(
  deps: Pick<OnboardingDeps, "stateDir" | "writeFile">,
): Promise<void> {
  await deps.writeFile(
    onboardingMarkerPath(deps.stateDir),
    `completedAt: ${new Date().toISOString()}\n`,
  )
}

export type OnboardingResult = "completed" | "cancelled" | "skipped"

/**
 * Interactive first-run wizard: welcome → telemetry consent → auth setup →
 * theme basics → summary. Non-interactive environments (CI, piped stdin) skip
 * gracefully without prompting.
 */
export async function runOnboardingWizard(
  deps?: Partial<OnboardingDeps>,
): Promise<OnboardingResult> {
  const d = { ...(await defaultOnboardingDeps()), ...deps }

  if (!d.interactive || d.isCI) {
    UI.println(
      "gizzi onboarding: non-interactive environment detected — skipping the setup wizard. " +
        "Run `gizzi --onboarding` in a terminal to configure telemetry, auth, and theme.",
    )
    return "skipped"
  }

  prompts.intro("Welcome to gizzi — let's get you set up")

  // ── Telemetry consent ──
  const telemetry = await prompts.confirm({
    message: "Allow anonymous usage telemetry? (never prompts, file contents, or credentials)",
    initialValue: true,
  })
  if (prompts.isCancel(telemetry)) {
    prompts.outro("Onboarding cancelled — run `gizzi --onboarding` anytime to finish setup")
    return "cancelled"
  }
  setTelemetryEnabled(telemetry === true)
  markTelemetryNoticeShown()

  // ── Auth setup ──
  const authChoice = await prompts.select({
    message: "How do you want to sign in?",
    options: [
      { value: "api-key", label: "Paste an API key", hint: "stored in the OS keyring when available" },
      { value: "skip", label: "Skip for now", hint: "run `gizzi auth login` later" },
    ],
  })
  if (prompts.isCancel(authChoice)) {
    prompts.outro("Onboarding cancelled — run `gizzi --onboarding` anytime to finish setup")
    return "cancelled"
  }

  let authSummary = "skipped (run `gizzi auth login` when you're ready)"
  if (authChoice === "api-key") {
    const key = await prompts.password({
      message: "API key",
      validate: (value) => (value?.trim() ? undefined : "Required"),
    })
    if (prompts.isCancel(key)) {
      prompts.outro("Onboarding cancelled — run `gizzi --onboarding` anytime to finish setup")
      return "cancelled"
    }
    try {
      const result = await loginApiKey(configTomlPath(), key.trim(), {
        provider: "anthropic",
        profile: "default",
      })
      authSummary = `signed in via API key (${result.method})`
    } catch (e) {
      authSummary = `sign-in failed (${e instanceof Error ? e.message : String(e)}) — retry with \`gizzi auth login\``
    }
  }

  // ── Theme basics ──
  let themeSummary = "unchanged"
  try {
    const prefs = await loadPreferences()
    const theme = await prompts.select({
      message: "Pick a theme",
      initialValue: (prefs.theme as string | undefined) ?? "dark",
      options: [
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
        { value: "system", label: "System" },
      ],
    })
    if (prompts.isCancel(theme)) {
      prompts.outro("Onboarding cancelled — run `gizzi --onboarding` anytime to finish setup")
      return "cancelled"
    }
    await savePreferences({ ...prefs, theme: theme as string })
    themeSummary = String(theme)
  } catch {
    // Theme preferences are best-effort; a missing preferences store must not
    // block onboarding.
  }

  await markOnboardingComplete(d)

  // ── Summary ──
  prompts.log.info(`Telemetry: ${telemetry === true ? "on" : "off"} — change anytime with \`gizzi config telemetry on|off\``)
  prompts.log.info(`Auth: ${authSummary}`)
  prompts.log.info(`Theme: ${themeSummary}`)
  prompts.outro("All set — docs: https://docs.gizziio.com · get started by just typing `gizzi`")

  return "completed"
}

export const OnboardingCommand = cmd({
  command: "onboarding",
  describe: "run the interactive first-run setup wizard",
  builder: (yargs) => yargs,
  async handler() {
    const result = await runOnboardingWizard()
    if (result === "cancelled") throw new UI.CancelledError()
  },
})
