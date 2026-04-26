import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { Log } from "@/shared/util/log"
import { getCwd } from "@/shared/utils/cwd"
import {
  getTeamFilePath,
  readTeamFile,
  cleanupTeamDirectories,
} from "@/shared/utils/swarm/teamHelpers"
import { getTeamsDir } from "@/shared/utils/envUtils"
import { isAgentSwarmsEnabled } from "@/shared/utils/agentSwarmsEnabled"
import { readdir } from "fs/promises"

const log = Log.create({ service: "swarm-cli" })

async function listTeams(): Promise<string[]> {
  try {
    const entries = await readdir(getTeamsDir(), { withFileTypes: true })
    return entries.filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

export const SwarmCommand = cmd({
  command: "swarm [action]",
  describe: "Multi-agent swarm orchestration",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["list", "create", "delete", "status"],
        describe: "Swarm action",
        default: "list",
      })
      .option("name", {
        type: "string",
        alias: "n",
        describe: "Team name (for create/delete)",
      })
      .option("description", {
        type: "string",
        alias: "d",
        describe: "Team description (for create)",
      })
      .option("agents", {
        type: "number",
        alias: "a",
        describe: "Number of agents (for create)",
        default: 3,
      })
      .option("mode", {
        type: "string",
        choices: ["agentic", "claude", "closed_loop", "hybrid"],
        describe: "Swarm mode",
        default: "agentic",
      }),

  handler: async (args) => {
    const action = args.action as "list" | "create" | "delete" | "status"

    if (!isAgentSwarmsEnabled()) {
      UI.println(UI.Style.TEXT_WARNING + "⚠️  Agent swarms are disabled." + UI.Style.RESET)
      UI.println("Enable with: export GIZZI_SWARMS=1")
      return
    }

    try {
      switch (action) {
        case "list": {
          const teams = await listTeams()
          if (teams.length === 0) {
            UI.println(UI.Style.TEXT_INFO + "No teams found." + UI.Style.RESET)
            UI.println("Create one with: gizzi swarm create -n my-team")
            return
          }

          UI.println(UI.Style.TEXT_INFO_BOLD + `🐝 ${teams.length} Team(s)` + UI.Style.RESET)
          for (const name of teams) {
            const team = readTeamFile(name)
            if (team) {
              UI.println(`  • ${team.name}`)
              UI.println(`    Description: ${team.description ?? "none"}`)
              UI.println(`    Teammates: ${team.teammates?.length ?? 0}`)
              UI.println(`    Created: ${team.created_at ? new Date(team.created_at).toLocaleString() : "unknown"}`)
            }
          }
          break
        }

        case "create": {
          if (!args.name) {
            UI.println(UI.Style.TEXT_ERROR + "❌ No team name provided. Use --name or -n" + UI.Style.RESET)
            process.exit(1)
          }

          UI.println(UI.Style.TEXT_INFO + `🐝 Creating team: ${args.name}` + UI.Style.RESET)
          UI.println(UI.Style.TEXT_WARNING + "Use the AI tool `/team-create` for full team spawning." + UI.Style.RESET)
          UI.println(`Team file will be created at: ${getTeamFilePath(args.name)}`)
          break
        }

        case "delete": {
          if (!args.name) {
            UI.println(UI.Style.TEXT_ERROR + "❌ No team name provided. Use --name or -n" + UI.Style.RESET)
            process.exit(1)
          }

          const team = readTeamFile(args.name)
          if (!team) {
            UI.println(UI.Style.TEXT_ERROR + `❌ Team not found: ${args.name}` + UI.Style.RESET)
            process.exit(1)
          }

          await cleanupTeamDirectories(args.name)
          UI.println(UI.Style.TEXT_SUCCESS + `✅ Deleted team: ${args.name}` + UI.Style.RESET)
          break
        }

        case "status": {
          const teams = await listTeams()
          UI.println(UI.Style.TEXT_INFO_BOLD + "🐝 Swarm Status" + UI.Style.RESET)
          UI.println(`  Teams: ${teams.length}`)
          UI.println(`  Mode: ${args.mode}`)
          UI.println(`  CWD: ${getCwd()}`)
          break
        }
      }
    } catch (err: any) {
      log.error("swarm command failed", { action, error: err.message })
      UI.println(UI.Style.TEXT_ERROR + `❌ Error: ${err.message}` + UI.Style.RESET)
      process.exit(1)
    }
  },
})
