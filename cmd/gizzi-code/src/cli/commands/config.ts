import type { Argv } from "yargs"
import path from "path"
import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { Global } from "@/runtime/context/global"
import {
  addPermissionProfile,
  readPermissionProfiles,
  removePermissionProfile,
  setActivePermissionProfile,
  type PermissionAction,
} from "@/runtime/context/config/permission-profiles"

const configPath = () => path.join(Global.Path.config, "config.toml")

const PERMISSION_ACTIONS: PermissionAction[] = ["ask", "allow", "deny"]

function parseRules(rules: string[] | undefined): Record<string, PermissionAction> {
  const result: Record<string, PermissionAction> = {}
  for (const rule of rules ?? []) {
    const [key, action] = rule.split("=")
    if (!key || !action) throw new Error(`Invalid rule "${rule}", expected format <tool>=<ask|allow|deny>`)
    if (!PERMISSION_ACTIONS.includes(action as PermissionAction)) {
      throw new Error(`Invalid action "${action}" for rule "${key}", expected one of ${PERMISSION_ACTIONS.join(", ")}`)
    }
    result[key] = action as PermissionAction
  }
  return result
}

const ProfileListCommand = cmd({
  command: "list",
  describe: "list permission profiles",
  async handler() {
    const profiles = await readPermissionProfiles(configPath())
    const names = Object.keys(profiles.profiles).sort()
    if (names.length === 0) {
      UI.println("No permission profiles configured.")
      return
    }
    for (const name of names) {
      const profile = profiles.profiles[name]!
      const rules = Object.entries(profile.rules)
        .map(([key, action]) => `${key}=${action}`)
        .join(" ")
      UI.println(`${profiles.active_profile === name ? "*" : " "} ${name} (${rules})`)
    }
  },
})

const ProfileAddCommand = cmd({
  command: "add <name>",
  describe: "add a permission profile",
  builder: (yargs) =>
    yargs
      .positional("name", { type: "string", demandOption: true })
      .option("rule", {
        type: "array",
        string: true,
        describe: "permission rule in the form <tool>=<ask|allow|deny>, may be repeated",
      }),
  async handler(args) {
    const rules = parseRules(args.rule as string[] | undefined)
    await addPermissionProfile(configPath(), args.name, rules)
    UI.println(`Added permission profile: ${args.name}`)
  },
})

const ProfileRemoveCommand = cmd({
  command: "remove <name>",
  aliases: ["rm"],
  describe: "remove a permission profile",
  builder: (yargs) => yargs.positional("name", { type: "string", demandOption: true }),
  async handler(args) {
    await removePermissionProfile(configPath(), args.name)
    UI.println(`Removed permission profile: ${args.name}`)
  },
})

const ProfileSetActiveCommand = cmd({
  command: "set-active <name>",
  describe: "select the active permission profile",
  builder: (yargs) => yargs.positional("name", { type: "string", demandOption: true }),
  async handler(args) {
    await setActivePermissionProfile(configPath(), args.name)
    UI.println(`Active permission profile: ${args.name}`)
  },
})

const ProfileCommand = cmd({
  command: "profile",
  describe: "manage named permission profiles",
  builder: (yargs: Argv) =>
    yargs
      .command(ProfileListCommand)
      .command(ProfileAddCommand)
      .command(ProfileRemoveCommand)
      .command(ProfileSetActiveCommand)
      .demandCommand(),
  async handler() {},
})

export const ConfigCommand = cmd({
  command: "config",
  describe: "manage gizzi configuration",
  builder: (yargs: Argv) => yargs.command(ProfileCommand).demandCommand(),
  async handler() {},
})
