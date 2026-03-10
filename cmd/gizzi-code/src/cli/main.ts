import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RunCommand } from "@/cli/commands/run"
import { GenerateCommand } from "@/cli/commands/generate"
import { Log } from "@/shared/util/log"
import { ConnectCommand } from "@/cli/commands/connect"
import { SkillsCommand } from "@/cli/commands/skills"
import { UpgradeCommand } from "@/cli/commands/upgrade"
import { UninstallCommand } from "@/cli/commands/uninstall"
import { ModelsCommand } from "@/cli/commands/models"
import { UI } from "@/cli/ui"
import { Installation } from "@/shared/installation"
import { NamedError } from "@a2r/util/error"
import { FormatError } from "@/shared/error/format"
import { ServeCommand } from "@/cli/commands/serve"
import { Filesystem } from "@/shared/util/filesystem"
import { DebugCommand } from "@/cli/commands/debug"
import { StatsCommand } from "@/cli/commands/stats"
import { McpCommand } from "@/cli/commands/mcp"
import { GithubCommand } from "@/cli/commands/github"
import { ExportCommand } from "@/cli/commands/export"
import { ImportCommand } from "@/cli/commands/import"
import { AttachCommand } from "@/cli/ui/tui/attach"
import { TuiThreadCommand } from "@/cli/ui/tui/thread"
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
import path from "path"
import { Global } from "@/runtime/context/global"
import { JsonMigration } from "@/runtime/session/storage/json-migration"
import { Database } from "@/runtime/session/storage/db"
import { ResolveMessage } from "bun"

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

const cli = yargs(hideBin(process.argv))
  .parserConfiguration({ "populate--": true })
  .scriptName("gizzi-code")
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
  .middleware(async (opts) => {
    await Log.init({
      print: process.argv.includes("--print-logs"),
      dev: Installation.isLocal(),
      level: (() => {
        if (opts.logLevel) return opts.logLevel as Log.Level
        if (Installation.isLocal()) return "DEBUG"
        return "INFO"
      })(),
    })

    process.env.AGENT = "1"
    process.env.GIZZI = "1"
    process.env.GIZZI = "1"

    Log.Default.info("gizzi", {
      version: Installation.VERSION,
      args: process.argv.slice(2),
    })

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
  .command(GenerateCommand)
  .command(DebugCommand)
  .command(ConnectCommand)
  .command(SkillsCommand)
  .command(UpgradeCommand)
  .command(UninstallCommand)
  .command(ServeCommand)
  .command(WebCommand)
  .command(ModelsCommand)
  .command(StatsCommand)
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

try {
  await cli.parse()
} catch (e) {
  let data: Record<string, any> = {}
  if (e instanceof NamedError) {
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
    process.stderr.write((e instanceof Error ? e.message : String(e)) + EOL)
  }
  process.exitCode = 1
} finally {
  // Some subprocesses don't react properly to SIGTERM and similar signals.
  // Most notably, some docker-container-based MCP servers don't handle such signals unless
  // run using `docker run --init`.
  // Explicitly exit to avoid any hanging subprocesses.
  process.exit()
}
