import type { Argv } from "yargs"
import * as prompts from "@clack/prompts"
import path from "path"
import { cmd } from "@/cli/commands/cmd"
import { UI } from "@/cli/ui"
import { Global } from "@/runtime/context/global"
import {
  addAuthProfile,
  readAuthProfiles,
  removeAuthProfile,
  setActiveAuthProfile,
} from "@/runtime/context/config/auth-profiles"

const configPath = () => path.join(Global.Path.config, "config.toml")

const ProfileListCommand = cmd({
  command: "list",
  describe: "list authentication profiles",
  async handler() {
    const auth = await readAuthProfiles(configPath())
    const names = Object.keys(auth.profiles).sort()
    if (names.length === 0) {
      UI.println("No authentication profiles configured.")
      return
    }
    for (const name of names) {
      const profile = auth.profiles[name]!
      UI.println(`${auth.active_profile === name ? "*" : " "} ${name} (${profile.provider})`)
    }
  },
})

const ProfileAddCommand = cmd({
  command: "add <name>",
  describe: "add an authentication profile",
  builder: (yargs) => yargs
    .positional("name", { type: "string", demandOption: true })
    .option("provider", { type: "string", describe: "provider id" })
    .option("api-key", { type: "string", describe: "API key" })
    .option("api-key-env", { type: "string", describe: "environment variable containing the API key" })
    .option("base-url", { type: "string", describe: "provider base URL" }),
  async handler(args) {
    const interactive = !args.provider && !args.apiKey && !args.apiKeyEnv && !args.baseUrl
    let provider = args.provider
    if (!provider) {
      const answer = await prompts.text({
        message: "Provider",
        validate: (value) => value?.trim() ? undefined : "Required",
      })
      if (prompts.isCancel(answer)) throw new UI.CancelledError()
      provider = answer.trim()
    }
    let apiKeyEnv = args.apiKeyEnv
    let baseUrl = args.baseUrl
    if (interactive) {
      const envAnswer = await prompts.text({
        message: "API key environment variable (optional)",
        placeholder: "ANTHROPIC_API_KEY",
      })
      if (prompts.isCancel(envAnswer)) throw new UI.CancelledError()
      apiKeyEnv = envAnswer.trim() || undefined
      const urlAnswer = await prompts.text({
        message: "Provider base URL (optional)",
      })
      if (prompts.isCancel(urlAnswer)) throw new UI.CancelledError()
      baseUrl = urlAnswer.trim() || undefined
    }
    await addAuthProfile(configPath(), args.name, {
      provider,
      api_key: args.apiKey,
      api_key_env: apiKeyEnv,
      base_url: baseUrl,
    })
    UI.println(`Added auth profile: ${args.name}`)
  },
})

const ProfileRemoveCommand = cmd({
  command: "remove <name>",
  aliases: ["rm"],
  describe: "remove an authentication profile",
  builder: (yargs) => yargs.positional("name", { type: "string", demandOption: true }),
  async handler(args) {
    await removeAuthProfile(configPath(), args.name)
    UI.println(`Removed auth profile: ${args.name}`)
  },
})

const ProfileSetActiveCommand = cmd({
  command: "set-active <name>",
  describe: "select the active authentication profile",
  builder: (yargs) => yargs.positional("name", { type: "string", demandOption: true }),
  async handler(args) {
    await setActiveAuthProfile(configPath(), args.name)
    UI.println(`Active auth profile: ${args.name}`)
  },
})

const ProfileCommand = cmd({
  command: "profile",
  describe: "manage authentication profiles",
  builder: (yargs: Argv) => yargs
    .command(ProfileListCommand)
    .command(ProfileAddCommand)
    .command(ProfileRemoveCommand)
    .command(ProfileSetActiveCommand)
    .demandCommand(),
  async handler() {},
})

export const AuthCommand = cmd({
  command: "auth",
  describe: "manage authentication",
  builder: (yargs: Argv) => yargs.command(ProfileCommand).demandCommand(),
  async handler() {},
})
