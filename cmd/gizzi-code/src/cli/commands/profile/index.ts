// @ts-nocheck
/**
 * Profile Command
 *
 * Manage named Gizzi Code config profiles across user, project, and CI scopes.
 *
 * Usage:
 *   gizzi profile list              — list all profiles
 *   gizzi profile save <name>       — save current config as a profile
 *   gizzi profile activate <name>   — activate a profile
 *   gizzi profile deactivate        — deactivate the current profile
 *   gizzi profile delete <name>     — delete a profile
 *   gizzi profile show [name]       — show profile details
 */

import type { CommandModule } from "yargs"
import { ConfigProfiles } from "@/config/profiles"
import { UI } from "@/cli/ui"

async function printProfile(entry: ConfigProfiles.ProfileEntry, active: boolean) {
  const marker = active ? " ✓ active" : ""
  UI.info(`  ${entry.name} [${entry.scope}]${marker}`)
  if (entry.description) UI.info(`    ${entry.description}`)
  UI.info(`    source: ${entry.source}`)
}

export const ProfileCommand: CommandModule = {
  command: "profile <action> [name]",
  describe: "manage config profiles (user, project, CI)",
  builder: (yargs) =>
    yargs
      .positional("action", {
        describe: "profile action",
        choices: ["list", "ls", "save", "activate", "use", "deactivate", "delete", "rm", "show"],
        type: "string",
        demandOption: true,
      })
      .positional("name", {
        describe: "profile name",
        type: "string",
      })
      .option("scope", {
        describe: "profile scope",
        choices: ["user", "project", "ci"],
        default: "project",
        type: "string",
      })
      .option("description", {
        describe: "profile description (for save)",
        type: "string",
      }),
  handler: async (argv) => {
    const action = argv.action as string
    const name = argv.name as string | undefined
    const scope = (argv.scope as ConfigProfiles.Scope) ?? "project"

    try {
      switch (action) {
        case "list":
        case "ls": {
          const all = await ConfigProfiles.listAll()
          const active = await ConfigProfiles.getActive()
          if (all.length === 0) {
            UI.info("No profiles configured.")
            UI.info("Create one with: gizzi profile save <name> --scope <user|project|ci>")
            return
          }
          UI.info("Profiles:")
          for (const entry of all) {
            await printProfile(entry, entry.name === active?.name && entry.scope === active?.scope)
          }
          break
        }

        case "save": {
          if (!name) {
            UI.error("Profile name is required. Usage: gizzi profile save <name>")
            process.exit(1)
          }
          // Save an empty profile as a starting point — users populate it via config edit
          const entry = await ConfigProfiles.save(
            name,
            scope,
            {},
            argv.description as string | undefined,
          )
          UI.success(`Profile '${name}' saved at scope '${scope}' → ${entry.source}`)
          break
        }

        case "activate":
        case "use": {
          if (!name) {
            UI.error("Profile name is required. Usage: gizzi profile activate <name>")
            process.exit(1)
          }
          const entry = await ConfigProfiles.activate(name)
          if (!entry) {
            UI.error(`Profile '${name}' not found in any scope.`)
            process.exit(1)
          }
          UI.success(`Activated profile '${name}' [${entry.scope}]`)
          break
        }

        case "deactivate": {
          await ConfigProfiles.deactivate()
          UI.success("All profiles deactivated.")
          break
        }

        case "delete":
        case "rm": {
          if (!name) {
            UI.error("Profile name is required. Usage: gizzi profile delete <name>")
            process.exit(1)
          }
          const removed = await ConfigProfiles.remove(name, scope)
          if (!removed) {
            UI.error(`Profile '${name}' not found at scope '${scope}'.`)
            process.exit(1)
          }
          UI.success(`Deleted profile '${name}' from scope '${scope}'.`)
          break
        }

        case "show": {
          if (!name) {
            const active = await ConfigProfiles.getActive()
            if (!active) {
              UI.info("No active profile.")
              return
            }
            await printProfile(active, true)
            UI.info("\nConfig overrides:")
            UI.info(JSON.stringify(active.config, null, 2))
            return
          }
          for (const s of ["ci", "project", "user"] as ConfigProfiles.Scope[]) {
            const entry = await ConfigProfiles.load(name, s)
            if (entry) {
              await printProfile(entry, false)
              UI.info("\nConfig overrides:")
              UI.info(JSON.stringify(entry.config, null, 2))
              return
            }
          }
          UI.error(`Profile '${name}' not found.`)
          process.exit(1)
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
