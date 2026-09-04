/**
 * API keys command
 *
 * Manage durable Allternit API tokens (`alt_`-prefixed keys minted by
 * allternit-cloud-api). Clerk session JWTs are ephemeral (~1 minute
 * lifetime) and are refused here — use the login flow for those.
 *
 * Usage:
 *   gizzi api-keys list              # List stored keys + ALLTERNIT_API_TOKEN from env
 *   gizzi api-keys set <name> <token>  # Store a durable alt_ token
 *   gizzi api-keys remove <name>     # Delete a stored key
 *
 * @module api-keys-command
 */

import type { Argv, CommandModule } from "yargs"
import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { classifyAllternitToken, maskToken } from "@/shared/utils/allternitToken"

interface StoredKey {
  token: string
  kind: string
  createdAt: string
}

type KeyFile = Record<string, StoredKey>

function configDir(): string {
  return process.env.GIZZI_CONFIG_DIR ?? path.join(os.homedir(), ".config", "gizzi-code")
}

function keyFilePath(): string {
  return path.join(configDir(), "api-keys.json")
}

function readKeys(): KeyFile {
  try {
    const raw = fs.readFileSync(keyFilePath(), "utf8")
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === "object") return parsed as KeyFile
  } catch {
    // Missing or corrupt file — treat as empty
  }
  return {}
}

function writeKeys(keys: KeyFile): void {
  fs.mkdirSync(configDir(), { recursive: true, mode: 0o700 })
  const tmp = keyFilePath() + ".tmp"
  fs.writeFileSync(tmp, JSON.stringify(keys, null, 2), { mode: 0o600 })
  fs.chmodSync(tmp, 0o600)
  fs.renameSync(tmp, keyFilePath())
}

function formatExpiry(expiresAt?: Date): string {
  if (!expiresAt) return "never"
  return expiresAt.toISOString()
}

const ListCommand: CommandModule = {
  command: "list",
  describe: "list stored API keys and the ALLTERNIT_API_TOKEN env var",
  handler: () => {
    const rows: Array<{ name: string; masked: string; kind: string; expiry: string; source: string }> = []
    const envToken = process.env.ALLTERNIT_API_TOKEN
    if (envToken) {
      const info = classifyAllternitToken(envToken)
      rows.push({
        name: "(env)",
        masked: maskToken(envToken),
        kind: info.kind,
        expiry: info.kind === "jwt" ? formatExpiry(info.expiresAt) : "n/a",
        source: "env",
      })
    }
    for (const [name, entry] of Object.entries(readKeys())) {
      rows.push({
        name,
        masked: maskToken(entry.token),
        kind: entry.kind,
        expiry: entry.kind === "jwt" ? formatExpiry(
          classifyAllternitToken(entry.token).expiresAt,
        ) : "n/a",
        source: "file",
      })
    }
    if (rows.length === 0) {
      console.log("No API keys stored. Set one with: gizzi api-keys set <name> <alt_... token>")
      process.exit(0)
    }
    const nameW = Math.max(4, ...rows.map((r) => r.name.length))
    const maskedW = Math.max(5, ...rows.map((r) => r.masked.length))
    const kindW = Math.max(4, ...rows.map((r) => r.kind.length))
    console.log(
      `${"NAME".padEnd(nameW)}  ${"TOKEN".padEnd(maskedW)}  ${"KIND".padEnd(kindW)}  EXPIRES  SOURCE`,
    )
    for (const r of rows) {
      console.log(
        `${r.name.padEnd(nameW)}  ${r.masked.padEnd(maskedW)}  ${r.kind.padEnd(kindW)}  ${r.expiry}  ${r.source}`,
      )
    }
    process.exit(0)
  },
}

const SetCommand: CommandModule = {
  command: "set <name> <token>",
  describe: "store a durable alt_ API token under a name",
  builder: (yargs) =>
    yargs
      .positional("name", { type: "string", describe: "name for the stored key" })
      .positional("token", { type: "string", describe: "the alt_-prefixed API token" })
      .option("force", {
        type: "boolean",
        describe: "store even if the token kind is unknown",
        default: false,
      }),
  handler: (argv) => {
    const args = argv as unknown as { name: string; token: string; force?: boolean }
    const info = classifyAllternitToken(args.token)
    if (info.kind === "jwt") {
      console.error(
        "refusing to store a Clerk session JWT: it expires in about a minute and will not work later.\n" +
          "Use a durable alt_ API token (mint one on the Allternit platform), or sign in again with `gizzi login`.",
      )
      process.exit(1)
    }
    if (info.kind === "unknown" && !args.force) {
      console.error(
        "token kind is unknown (not an alt_ API key and not a JWT).\n" +
          "Refusing to store it. Re-run with --force if you are sure.",
      )
      process.exit(1)
    }
    const keys = readKeys()
    keys[args.name] = {
      token: args.token,
      kind: info.kind,
      createdAt: new Date().toISOString(),
    }
    writeKeys(keys)
    console.log(`stored key "${args.name}" (${info.kind}) at ${keyFilePath()}`)
    process.exit(0)
  },
}

const RemoveCommand: CommandModule = {
  command: "remove <name>",
  describe: "remove a stored API key",
  builder: (yargs) => yargs.positional("name", { type: "string", describe: "name of the stored key" }),
  handler: (argv) => {
    const args = argv as unknown as { name: string }
    const keys = readKeys()
    if (!(args.name in keys)) {
      console.error(`no stored key named "${args.name}"`)
      process.exit(1)
    }
    delete keys[args.name]
    writeKeys(keys)
    console.log(`removed key "${args.name}"`)
    process.exit(0)
  },
}

export const ApiKeysCommand = {
  command: "api-keys",
  describe: "manage durable Allternit API tokens",
  builder: (yargs: Argv) =>
    yargs.command(ListCommand).command(SetCommand).command(RemoveCommand).demandCommand(),
  handler: () => {},
} satisfies CommandModule
