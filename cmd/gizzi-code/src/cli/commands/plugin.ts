import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { Config } from "@/runtime/context/config/config"
import { Global } from "@/runtime/context/global"
import { Filesystem } from "@/shared/util/filesystem"
import { modify, applyEdits } from "jsonc-parser"
import path from "path"

async function getConfigPath(): Promise<string> {
  const candidates = [
    path.join(Global.Path.config, "gizzi.jsonc"),
    path.join(Global.Path.config, "gizzi.json"),
    path.join(Global.Path.config, "config.json"),
  ]
  for (const p of candidates) {
    if (await Filesystem.exists(p)) return p
  }
  return candidates[1] // default to gizzi.json
}

async function getPluginList(): Promise<string[]> {
  const config = await Config.global()
  return config.plugin ?? []
}

async function updatePluginList(plugins: string[]) {
  const configPath = await getConfigPath()
  let text = "{}"
  if (await Filesystem.exists(configPath)) {
    text = await Filesystem.readText(configPath)
  }
  const edits = modify(text, ["plugin"], plugins, {
    formattingOptions: { tabSize: 2, insertSpaces: true },
  })
  const result = applyEdits(text, edits)
  await Filesystem.write(configPath, result)
  return configPath
}

const PluginInstallCommand = cmd({
  command: "install <package>",
  describe: "install a plugin package",
  builder: (yargs) =>
    yargs.positional("package", {
      type: "string",
      describe: "npm package name (optionally with @version)",
      demandOption: true,
    }),
  handler: async (args) => {
    const pkg = args.package as string
    const plugins = await getPluginList()

    // Check for duplicates (ignore version)
    const baseName = pkg.includes("@") ? pkg.substring(0, pkg.lastIndexOf("@")) : pkg
    const existing = plugins.find((p) => {
      const pBase = p.includes("@") ? p.substring(0, p.lastIndexOf("@")) : p
      return pBase === baseName
    })

    if (existing) {
      // Update version
      const idx = plugins.indexOf(existing)
      plugins[idx] = pkg
      const configPath = await updatePluginList(plugins)
      UI.println(`Updated ${existing} -> ${pkg} in ${configPath}`)
    } else {
      plugins.push(pkg)
      const configPath = await updatePluginList(plugins)
      UI.println(`Installed ${pkg} in ${configPath}`)
    }
  },
})

const PluginRemoveCommand = cmd({
  command: "remove <package>",
  describe: "remove a plugin package",
  builder: (yargs) =>
    yargs.positional("package", {
      type: "string",
      describe: "npm package name to remove",
      demandOption: true,
    }),
  handler: async (args) => {
    const pkg = args.package as string
    const plugins = await getPluginList()
    const baseName = pkg.includes("@") ? pkg.substring(0, pkg.lastIndexOf("@")) : pkg

    const filtered = plugins.filter((p) => {
      const pBase = p.includes("@") ? p.substring(0, p.lastIndexOf("@")) : p
      return pBase !== baseName
    })

    if (filtered.length === plugins.length) {
      UI.println(`Plugin ${pkg} not found in config`)
      return
    }

    const configPath = await updatePluginList(filtered)
    UI.println(`Removed ${pkg} from ${configPath}`)
  },
})

const PluginListCommand = cmd({
  command: "list",
  describe: "list installed plugins",
  handler: async () => {
    const plugins = await getPluginList()
    if (plugins.length === 0) {
      UI.println("No plugins configured")
      return
    }
    UI.println("Configured plugins:")
    for (const plugin of plugins) {
      UI.println(`  - ${plugin}`)
    }
  },
})

const PluginSearchCommand = cmd({
  command: "search <query>",
  describe: "search for plugins on npm",
  builder: (yargs) =>
    yargs.positional("query", {
      type: "string",
      describe: "search query",
      demandOption: true,
    }),
  handler: async (args) => {
    const query = args.query as string
    UI.println(`Searching npm for "${query}"...`)
    try {
      const proc = Bun.spawn(
        ["npm", "search", "--json", query, "--searchlimit=10"],
        { stdout: "pipe", stderr: "pipe" },
      )
      const output = await new Response(proc.stdout).text()
      const results = JSON.parse(output.trim()) as Array<{
        name: string
        description?: string
        version?: string
        keywords?: string[]
      }>

      if (results.length === 0) {
        UI.println("No results found")
        return
      }

      UI.println(`\nFound ${results.length} result(s):\n`)
      for (const r of results) {
        UI.println(`  ${r.name}@${r.version || "latest"}`)
        if (r.description) UI.println(`    ${r.description}`)
        UI.println("")
      }
      UI.println("Install with: gizzi-code plugin install <package>")
    } catch (e) {
      UI.error(`Search failed: ${e instanceof Error ? e.message : String(e)}`)
    }
  },
})

const PluginEnableCommand = cmd({
  command: "enable <name>",
  describe: "re-enable a disabled plugin for the current session",
  builder: (yargs) =>
    yargs.positional("name", {
      type: "string",
      describe: "plugin name to enable",
      demandOption: true,
    }),
  handler: async (args) => {
    const { Plugin } = await import("@/runtime/integrations/plugin")
    Plugin.enable(args.name as string)
    UI.println(`Plugin "${args.name}" enabled`)
  },
})

const PluginDisableCommand = cmd({
  command: "disable <name>",
  describe: "disable a plugin for the current session",
  builder: (yargs) =>
    yargs.positional("name", {
      type: "string",
      describe: "plugin name to disable",
      demandOption: true,
    }),
  handler: async (args) => {
    const { Plugin } = await import("@/runtime/integrations/plugin")
    Plugin.disable(args.name as string)
    UI.println(`Plugin "${args.name}" disabled`)
  },
})

export const PluginCommand = cmd({
  command: "plugin",
  describe: "manage plugins",
  builder: (yargs) =>
    yargs
      .command(PluginInstallCommand)
      .command(PluginRemoveCommand)
      .command(PluginListCommand)
      .command(PluginSearchCommand)
      .command(PluginEnableCommand)
      .command(PluginDisableCommand)
      .demandCommand(1, "specify a subcommand: install, remove, list, search, enable, disable"),
  handler: () => {},
})
