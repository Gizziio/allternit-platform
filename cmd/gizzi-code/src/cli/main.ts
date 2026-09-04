// @ts-nocheck
import "./devMacro"
import "drizzle-orm/sqlite-core/db.js"
import "drizzle-orm/sqlite-core/session.js"
import "drizzle-orm/bun-sqlite/session.js"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { ExecCommand, RunCommand } from "@/cli/commands/run"
import { GenerateCommand } from "@/cli/commands/generate"
import { ApiKeysCommand } from "@/cli/commands/api-keys"
import { Log } from "@/shared/util/log"
import { ConnectCommand } from "@/cli/commands/connect"
import { SkillsCommand } from "@/cli/commands/skills"
import { UpgradeCommand } from "@/cli/commands/upgrade"
import { UninstallCommand } from "@/cli/commands/uninstall"
import { ModelsCommand } from "@/cli/commands/models"
import { HardwareCommand } from "@/cli/commands/hardware"
import { UI } from "@/cli/ui"
import { Installation } from "@/shared/installation"
import { NamedErrorBase } from "@allternit/gizzi-util/error.js"
import { FormatError } from "@/shared/error/format"
import { ServeCommand } from "@/cli/commands/serve"
import { PairCommand, LoginCommand } from "@/cli/commands/pair"
import { Filesystem } from "@/shared/util/filesystem"
import { DebugCommand } from "@/cli/commands/debug"
import { StatsCommand } from "@/cli/commands/stats"
import { McpCommand } from "@/cli/commands/mcp"
import { GithubCommand } from "@/cli/commands/github"
import { ExportCommand } from "@/cli/commands/export"
import { ImportCommand } from "@/cli/commands/import"
import { AttachCommand } from "@/cli/ui/ink-app/attach"
import { TuiThreadCommand } from "@/cli/ui/ink-app/thread"
import { AcpCommand } from "@/cli/commands/acp"
import { EOL } from "os"
import { WebCommand } from "@/cli/commands/web"
import { PrCommand } from "@/cli/commands/pr"
import { SessionCommand } from "@/cli/commands/session"
import { DbCommand } from "@/cli/commands/db"
import { CronCommand } from "@/cli/commands/cron"
import { PluginCommand } from "@/cli/commands/plugin"
import { InitCommand } from "@/cli/commands/init"
import { DoctorCommand } from "@/cli/commands/doctor"
import { VerificationCommand } from "@/cli/commands/verification"
import { AgentHubCommand } from "@/cli/commands/agent-hub"
import { AcCommand } from "@/cli/commands/ac"
import { MailCommand } from "@/cli/commands/mail"
import { CoworkCommand } from "@/cli/commands/cowork"
import { CoworkTeamCommand } from "@/cli/commands/cowork-team"
import { AgentCommand } from "@/cli/commands/agent"
import { ProviderCommand } from "@/cli/commands/provider"
import { RuntimeCommand } from "@/cli/commands/runtime"
import { AllternitCommand } from "@/cli/commands/allternit"
import { StatusCommand } from "@/cli/commands/status"
import { BrainCommand } from "@/cli/commands/brain"
import { ProductsCommand } from "@/cli/commands/products"
import { HtmlArtifactCommand } from "@/cli/commands/html-artifact"
import { ProgramsCommand } from "@/cli/commands/programs"
import { OrgCommand } from "@/cli/commands/org"
import { LabsCommand } from "@/cli/commands/labs"
import { UdemyCommand } from "@/cli/commands/udemy"
import { VaultCommand } from "@/cli/commands/vault"
import { CodemapCommand } from "@/cli/commands/codemap"
import { AuthCommand } from "@/cli/commands/auth"
import { ConfigCommand } from "@/cli/commands/config"
import { ProfileCommand } from "@/cli/commands/profile"
import { PermissionProfileCommand } from "@/cli/commands/permission-profile"
import { CompletionsCommand } from "@/cli/commands/completions"
import { RemoteCommand } from "@/cli/commands/remote"
import { CIMode } from "@/cli/ci"
import path from "path"
import { Global, init as initGlobal } from "@/runtime/context/global"
import { JsonMigration } from "@/runtime/session/storage/json-migration"
import { Database } from "@/runtime/session/storage/db"
import { RuntimeTelemetry } from "@/runtime/telemetry"
import { telemetryDisabled } from "@/runtime/telemetry/privacy"
import {
  hasTelemetryNoticeBeenShown,
  markTelemetryNoticeShown,
} from "@/shared/utils/telemetrySettings"
import { getActiveSubsystems, getHarnessMode, shouldUseHarness } from "@/cli/ui/ink-app/utils/feature-flags"
import { Workspace } from "@/runtime/workspace/workspace"
import { getIsInteractive } from "@/cli/ui/ink-app/utils/feature-flags"
// ResolveMessage is a global class from bun-types
declare class ResolveMessage {
  readonly name: "ResolveMessage"
  readonly position: { line: number; column: number } | null
  readonly code: string
  readonly message: string
  readonly referrer: string
  readonly specifier: string
  readonly importKind: "entry_point" | "stmt" | "require" | "import" | "dynamic" | "require_resolve"
}

process.on("unhandledRejection", (e) => {
  Log.Default.error("rejection", {
    e: e instanceof Error ? e.message : e,
  })
})

process.on("uncaughtException", (e) => {
  Log.Default.error("exception", {
    e: e instanceof Error ? e.message : e,
  })
})

// Windows is not a supported platform (macOS primary, Linux supported).
// On win32 the secure-storage layer has no OS keychain backend, so
// getSecureStorage() returns plainTextStorage (a local .credentials.json
// written with best-effort 0o600 permissions). Warn once at boot instead of
// letting users assume keychain-grade protection.
if (process.platform === "win32" && !process.env.GIZZI_WINDOWS_WARNING_DISABLED) {
  process.stderr.write(
    "warning: gizzi-code on Windows is experimental and unsupported; " +
      "secure credential storage is unavailable, credentials fall back " +
      "to a permission-hardened local file. See: docs/TROUBLESHOOTING.md" +
      EOL,
  )
}

const cli = yargs(hideBin(process.argv))
  .parserConfiguration({ "populate--": true })
  .scriptName("gizzi")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", Installation.VERSION)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("onboarding", {
    describe: "force the setup onboarding wizard",
    type: "boolean",
  })
  .option("ci", {
    describe: "run in CI/non-interactive mode (structured output, no prompts)",
    type: "boolean",
  })
  .option("ci-format", {
    describe: "CI output format",
    choices: ["ndjson", "text", "markdown"],
    default: "ndjson",
  })
  .middleware(async (opts) => {
    await initGlobal()
    if (opts.onboarding) {
      process.env.GIZZI_TUI_FORCE_STARTUP_FLOW = "1"
    }
    await Log.init({
      print: process.argv.includes("--print-logs"),
      dev: Installation.isLocal(),
      level: (() => {
        if (opts.logLevel) return opts.logLevel as Log.Level
        if (Installation.isLocal()) return "DEBUG"
        return "INFO"
      })(),
    })
    RuntimeTelemetry.attach((record) => {
      Log.Default.info("runtime.telemetry", record)
    })

    // First-run telemetry disclosure: one line on the first interactive
    // launch when telemetry is enabled. Never prints when telemetry is
    // disabled via env/settings, in CI, or once already acknowledged.
    try {
      if (
        getIsInteractive() &&
        !CIMode.isCIEnvironment() &&
        !telemetryDisabled() &&
        !hasTelemetryNoticeBeenShown()
      ) {
        process.stderr.write(
          "gizzi telemetry: anonymous usage stats are enabled (never prompts, file contents, or credentials). " +
            "Disable with `gizzi config telemetry off` or GIZZI_TELEMETRY=off. " +
            "Details: cmd/gizzi-code/docs/telemetry.md\n"
        )
        markTelemetryNoticeShown()
      }
    } catch {
      // Disclosure is best-effort; never block startup.
    }

    // Activate CI mode if --ci flag or CI environment detected
    if (opts.ci || CIMode.isCIEnvironment()) {
      CIMode.activate({
        format: opts.ciFormat as "ndjson" | "text" | "markdown" | undefined,
      })
    }

    process.env.AGENT = "1"
    process.env.GIZZI = "1"
    process.env.GIZZI = "1"

    const harnessMode = getHarnessMode()
    const harnessActive = shouldUseHarness()
    const subsystems = getActiveSubsystems()
    Log.Default.info("gizzi", {
      version: Installation.VERSION,
      args: process.argv.slice(2),
      harness: {
        mode: harnessMode,
        active: harnessActive,
      },
      subsystems,
    })

    // Initialize .gizzi agent workspace if missing. This is the building
    // block of agent personality (IDENTITY.md, SOUL.md, USER.md, MEMORY.md,
    // AGENTS.md). Interactive users are offered the starter; non-interactive
    // runs silently create the global workspace.
    const localWorkspace = path.join(process.cwd(), ".gizzi")
    const globalWorkspace = Workspace.globalPath
    const localExists = await Filesystem.exists(localWorkspace)
    const globalExists = await Filesystem.exists(globalWorkspace)
    if (!localExists && !globalExists) {
      try {
        if (getIsInteractive()) {
          Log.Default.info("workspace", { msg: "no .gizzi workspace found; run `gizzi init` to create one" })
        } else {
          await Workspace.init(globalWorkspace)
          Log.Default.info("workspace", { msg: "created global .gizzi workspace", path: globalWorkspace })
        }
      } catch (e) {
        Log.Default.warn("workspace init failed", { error: e instanceof Error ? e.message : String(e) })
      }
    }

    const marker = path.join(Global.Path.data, "gizzi.db")
    /*
    if (!(await Filesystem.exists(marker))) {
      const tty = process.stderr.isTTY
...
      process.stderr.write("Database migration complete." + EOL)
    }
    */
  })
  .usage("\n" + UI.logo())
  .completion("completion", "generate shell completion script")
  .command(AcpCommand)
  .command(McpCommand)
  .command(TuiThreadCommand)
  .command(AttachCommand)
  .command(RunCommand)
  .command(ExecCommand)
  .command(GenerateCommand)
  .command(ApiKeysCommand)
  .command(DebugCommand)
  .command(ConnectCommand)
  .command(SkillsCommand)
  .command(UpgradeCommand)
  .command(UninstallCommand)
  .command(ServeCommand)
  .command(PairCommand)
  .command(LoginCommand)
  .command(WebCommand)
  .command(ModelsCommand)
  .command(HardwareCommand)
  .command(StatsCommand)
  .command(StatusCommand)
  .command(ExportCommand)
  .command(ImportCommand)
  .command(GithubCommand)
  .command(PrCommand)
  .command(SessionCommand)
  .command(DbCommand)
  .command(CronCommand)
  .command(PluginCommand)
  .command(InitCommand)
  .command(DoctorCommand)
  .command(VerificationCommand)
  .command(AgentHubCommand)
  .command(AcCommand)
  .command(MailCommand)
  .command(CoworkCommand)
  .command(CoworkTeamCommand)
  .command(AgentCommand)
  .command(ProviderCommand)
  .command(RuntimeCommand)
  .command(AllternitCommand)
  .command(BrainCommand)
  .command(HtmlArtifactCommand)
  .command(ProgramsCommand)
  .command(OrgCommand)
  .command(ProductsCommand)
  .command(LabsCommand)
  .command(UdemyCommand)
  .command(VaultCommand)
  .command(CodemapCommand)
  .command(AuthCommand)
  .command(ConfigCommand)
  .command(ProfileCommand)
  .command(PermissionProfileCommand)
  .command(CompletionsCommand)
  .command(RemoteCommand)
  .fail((msg, err) => {
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      if (err) throw err
      cli.showHelp("log")
    }
    if (err) throw err
    process.exit(1)
  })
  .strict()

// Commands that legitimately keep the process alive (TUI, servers, protocol
// stdio loops, attach/streaming forms). Everything NOT matched here is a
// one-shot command: its handler prints and returns, and the process must
// then exit. Bootstrap leaves live runtime handles (agent comms runtime,
// db watchers, lazily re-created Instances) that would otherwise hold the
// event loop open forever — the same disease print-mode `gizzi exec` had
// before it grew its own drain-then-exit. After the yargs handler resolves,
// one-shot commands get the same treatment centrally: drain stdout/stderr
// for 100ms, then exit with whatever exitCode the handler set.
function isLongLivedCommand(argv: { _: (string | number)[]; print?: boolean }): boolean {
  const [top, sub] = argv._ as string[]
  if (!top) return true // no subcommand → default TUI ($0 [project])
  switch (top) {
    case "run":
      // `run --print/-p` is one-shot and self-exits (run.ts); interactive
      // run starts the TUI and runs until the user quits.
      return !argv.print
    case "exec":
      // Print-only alias of run; already self-exits in run.ts print mode.
      return false
    case "attach": // attach to a running gizzi server (interactive TUI)
    case "serve": // headless gizzi server; runs until SIGINT/SIGTERM
    case "server": // future alias of serve; never force-exit
    case "web": // starts a local web server and blocks
    case "acp": // Agent Client Protocol server over stdio
    case "ssh": // future remote shell; interactive
    case "assistant": // future interactive assistant REPL
    case "remote-control": // future remote control session
      return true
    case "mcp":
      // `mcp serve` runs an MCP server; add/remove/list/auth/logout/debug
      // are one-shot.
      return sub === "serve"
    case "runtime":
      // `runtime daemon` is a WebSocket daemon; list/register/status exit.
      return sub === "daemon"
    case "cowork":
      // `cowork attach <run-id>` attaches to a live run; everything else
      // (list/start/stop/logs/show/schedule/approval/checkpoint) exits.
      return sub === "attach"
    case "remote":
      // `remote connect` opens an interactive remote session and
      // `remote logs` streams; list/status/test/setup/config exit.
      return sub === "connect" || sub === "logs"
    default:
      return false
  }
}

let parsedArgv: { _: (string | number)[]; print?: boolean } | undefined
try {
  parsedArgv = await cli.parse()
} catch (e) {
  let data: Record<string, any> = {}
  if (e instanceof NamedErrorBase) {
    const obj = e.toObject()
    Object.assign(data, {
      ...obj.data,
    })
  }

  if (e instanceof Error) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      cause: e.cause?.toString(),
      stack: e.stack,
    })
  }

  if (e instanceof ResolveMessage) {
    Object.assign(data, {
      name: e.name,
      message: e.message,
      code: e.code,
      specifier: e.specifier,
      referrer: e.referrer,
      position: e.position,
      importKind: e.importKind,
    })
  }
  Log.Default.error("fatal", data)
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error, check log file at " + Log.file() + " for more details" + EOL)
    process.stderr.write((e instanceof Error ? (e.stack || e.message) : String(e)) + EOL)
  }
  process.exitCode = 1
}

// On parse failure we have no parsed argv — recover the command path from
// raw tokens (first non-option arg) so long-lived commands that error early
// still don't get a forced exit scheduled underneath them.
const fallbackArgv = { _: hideBin(process.argv).filter((t) => !t.startsWith("-")) as (string | number)[] }
if (!isLongLivedCommand(parsedArgv ?? fallbackArgv)) {
  setTimeout(() => process.exit(process.exitCode ?? 0), 100)
}
// Sat Mar 14 17:36:51 CDT 2026
// force recompile Sat Mar 14 17:51:09 CDT 2026
// force recompile Sat Mar 14 17:52:07 CDT 2026
// force recompile Sat Mar 14 21:34:16 CDT 2026
// force Sat Mar 14 21:39:31 CDT 2026
// force Sat Mar 14 21:39:52 CDT 2026
// force recompile Sat Mar 14 21:40:25 CDT 2026
// force Sat Mar 14 21:47:35 CDT 2026
