// @ts-nocheck
/**
 * Permission Profile Command
 *
 * Manage filesystem-based permission profiles for Gizzi Code.
 *
 * Usage:
 *   gizzi permission-profile list                  — list available profiles
 *   gizzi permission-profile show <name>           — show profile details
 *   gizzi permission-profile activate <name>       — activate a profile
 *   gizzi permission-profile deactivate            — deactivate current profile
 *   gizzi permission-profile save <name>           — save a custom profile
 *   gizzi permission-profile delete <name>         — delete a profile
 */

import type { CommandModule } from "yargs"
import { PermissionProfiles } from "@/config/permissionProfiles"
import { UI } from "@/cli/ui"

export const PermissionProfileCommand: CommandModule = {
  command: "permission-profile <action> [name]",
  aliases: ["perm-profile"],
  describe: "manage filesystem permission profiles",
  builder: (yargs) =>
    yargs
      .positional("action", {
        describe: "action to perform",
        choices: ["list", "ls", "show", "activate", "use", "deactivate", "save", "delete", "rm", "presets"],
        type: "string",
        demandOption: true,
      })
      .positional("name", {
        describe: "profile name",
        type: "string",
      })
      .option("scope", {
        describe: "profile scope",
        choices: ["user", "project"],
        default: "project",
        type: "string",
      })
      .option("description", {
        describe: "profile description (for save)",
        type: "string",
      })
      .option("json", {
        describe: "output rules as JSON (for save)",
        type: "string",
      }),
  handler: async (argv) => {
    const action = argv.action as string
    const name = argv.name as string | undefined
    const scope = (argv.scope as PermissionProfiles.Scope) ?? "project"

    try {
      switch (action) {
        case "list":
        case "ls": {
          const presets = PermissionProfiles.listPresets()
          UI.info("Built-in presets:")
          for (const p of presets) {
            const entry = PermissionProfiles.getPreset(p)!
            UI.info(`  ${p} — ${entry.description}`)
          }

          for (const s of ["user", "project"] as PermissionProfiles.Scope[]) {
            const profiles = await PermissionProfiles.listAll(s)
            if (profiles.length > 0) {
              UI.info(`\n${s} profiles:`)
              for (const entry of profiles) {
                const active = await PermissionProfiles.getActiveName(s)
                const marker = entry.name === active ? " (active)" : ""
                UI.info(`  ${entry.name}${marker}${entry.description ? ` — ${entry.description}` : ""}`)
              }
            }
          }
          break
        }

        case "presets": {
          const presets = PermissionProfiles.listPresets()
          for (const p of presets) {
            const entry = PermissionProfiles.getPreset(p)!
            UI.info(`\n${p}: ${entry.description}`)
            UI.info(JSON.stringify(entry.rules, null, 2))
          }
          break
        }

        case "show": {
          if (!name) {
            const effective = await PermissionProfiles.getEffective()
            if (!effective) {
              UI.info("No active permission profile.")
              return
            }
            UI.info(`Active: ${effective.name}`)
            if (effective.description) UI.info(`  ${effective.description}`)
            UI.info("\nRules:")
            UI.info(JSON.stringify(effective.rules, null, 2))
            if (effective.sandbox) {
              UI.info("\nSandbox:")
              UI.info(JSON.stringify(effective.sandbox, null, 2))
            }
            return
          }
          const entry = await PermissionProfiles.resolve(name)
          if (!entry) {
            UI.error(`Permission profile '${name}' not found.`)
            process.exit(1)
          }
          UI.info(`${entry.name}:`)
          if (entry.description) UI.info(`  ${entry.description}`)
          UI.info("\nRules:")
          UI.info(JSON.stringify(entry.rules, null, 2))
          break
        }

        case "activate":
        case "use": {
          if (!name) {
            UI.error("Profile name is required.")
            process.exit(1)
          }
          const entry = await PermissionProfiles.resolve(name)
          if (!entry) {
            UI.error(`Permission profile '${name}' not found.`)
            process.exit(1)
          }
          await PermissionProfiles.activate(name, scope)
          UI.success(`Activated permission profile '${name}' at scope '${scope}'.`)
          break
        }

        case "deactivate": {
          await PermissionProfiles.deactivate()
          UI.success("Permission profile deactivated.")
          break
        }

        case "save": {
          if (!name) {
            UI.error("Profile name is required.")
            process.exit(1)
          }
          const jsonArg = argv.json as string | undefined
          if (!jsonArg) {
            UI.error("Provide rules as JSON via --json '{...}'")
            process.exit(1)
          }
          const rules = JSON.parse(jsonArg)
          const entry: PermissionProfiles.FileEntry = {
            name,
            ...(argv.description ? { description: argv.description as string } : {}),
            rules,
          }
          const filePath = await PermissionProfiles.save(name, scope, entry)
          UI.success(`Saved permission profile '${name}' → ${filePath}`)
          break
        }

        case "delete":
        case "rm": {
          if (!name) {
            UI.error("Profile name is required.")
            process.exit(1)
          }
          const removed = await PermissionProfiles.remove(name, scope)
          if (!removed) {
            UI.error(`Permission profile '${name}' not found at scope '${scope}'.`)
            process.exit(1)
          }
          UI.success(`Deleted permission profile '${name}'.`)
          break
        }

        default:
          UI.error(`Unknown action: ${action}`)
          process.exit(1)
      }
    } catch (e) {
      UI.error(e instanceof Error ? e.message : String(e))
      process.exit(1)
    }
  },
}
