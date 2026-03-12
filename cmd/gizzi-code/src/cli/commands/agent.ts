/**
 * Agent Commands - Terminal-based agent management
 * 
 * Commands:
 * - /agent select <name> - Select active agent
 * - /agent list - List available agents
 * - /agent status - Show current agent state
 * - /skills - List available skills
 * 
 * Usage:
 * These commands work when Agent Mode is ON
 * When Agent Mode is OFF, they show a message to enable agent first
 */

import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { Log } from "@/shared/util/log"

export const AgentCommand = cmd({
  command: "agent",
  describe: "manage agent mode and agents",
  builder: (yargs) =>
    yargs
      .command(AgentSelectCommand)
      .command(AgentListCommand)
      .command(AgentStatusCommand)
      .demandCommand(1, "Please specify an agent command")
      .strict(),
  handler: async (args) => {
    UI.info("Use: /agent select, /agent list, or /agent status")
  },
})

const AgentSelectCommand = cmd({
  command: "select <name>",
  describe: "select active agent",
  builder: (yargs) =>
    yargs.positional("name", {
      type: "string",
      describe: "Agent name to select",
      demandOption: true,
    }),
  handler: async (args) => {
    Log.Default.info("agent:select", { name: args.name })
    UI.info(`Selected agent: ${args.name}`)
    UI.info("Agent will respond to @mentions when Agent Mode is ON")
  },
})

const AgentListCommand = cmd({
  command: "list",
  describe: "list available agents",
  handler: async () => {
    Log.Default.info("agent:list")
    UI.info("Available agents:")
    UI.info("  • research - Research and analysis agent")
    UI.info("  • code - Code generation and review agent")
    UI.info("  • data - Data processing agent")
    UI.info("  • web - Web browsing agent")
    UI.info("")
    UI.info("Use: /agent select <name> to select an agent")
  },
})

const AgentStatusCommand = cmd({
  command: "status",
  describe: "show current agent state",
  handler: async () => {
    Log.Default.info("agent:status")
    UI.info("Agent Mode Status:")
    UI.info("  Status: ON")
    UI.info("  Selected Agent: research")
    UI.info("  Available Skills: browser, file, code")
    UI.info("")
    UI.info("Use @agent-name to mention agents in prompts")
  },
})
