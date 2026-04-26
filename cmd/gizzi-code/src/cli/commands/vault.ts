/**
 * Vault CLI Command
 *
 * Commands:
 * - gizzi vault init              Initialize the knowledge vault
 * - gizzi vault query <text>      Search the vault
 * - gizzi vault write <folder> <title> <content>  Write a note
 * - gizzi vault sync [source]     Trigger sync (gmail|calendar|fireflies|all)
 * - gizzi vault daily             Open today's daily note
 * - gizzi vault graph             Rebuild entity graph
 * - gizzi vault live              Update live notes
 * - gizzi vault status            Show vault statistics
 */

import { cmd } from "./cmd"
import { VaultManager } from "@/vault"
import { runSync, runAllSyncs } from "@/vault/sync"
import { listConnectors, getConnector } from "@/vault/connector"
import { updateAllLiveNotes } from "@/vault/notes/live"
import { ensureVaultStructure } from "@/vault/io"
import { loadSettings, saveSettings, setSourceEnabled, setGoogleCredentials, setFirefliesApiKey, setVoiceConfig } from "@/vault/settings"
import { Auth } from "@/runtime/integrations/auth"
import { Global } from "@/runtime/context/global"
import path from "path"
import readline from "readline"

function readLine(): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question("", (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

export const VaultCommand = cmd({
  command: "vault",
  describe: "manage the knowledge vault",
  builder: (yargs) =>
    yargs
      .command(
        "init",
        "Initialize the knowledge vault",
        () => {},
        async () => {
          const vault = new VaultManager()
          await vault.initialize()
          console.log(`Vault initialized at: ${vault.rootPath}`)
          vault.close()
        },
      )
      .command(
        "query <text>",
        "Search the vault",
        (yargs) =>
          yargs
            .positional("text", { type: "string", demandOption: true, describe: "Search query" })
            .option("folder", { type: "string", describe: "Filter by folder" })
            .option("limit", { type: "number", default: 10, describe: "Max results" }),
        async (argv) => {
          const vault = new VaultManager()
          await vault.initialize()
          const result = await vault.query({
            text: argv.text as string,
            folder: argv.folder as string | undefined,
            limit: argv.limit as number,
          })
          console.log(`Found ${result.total} note(s)${result.truncated ? " (truncated)" : ""}`)
          for (const note of result.notes) {
            console.log(`\n[${note.folder || "root"}] ${note.title}`)
            console.log(`  Tags: ${note.frontmatter.tags?.join(", ") || "none"}`)
            const preview = note.content.slice(0, 200).replace(/\n/g, " ")
            console.log(`  ${preview}${note.content.length > 200 ? "..." : ""}`)
          }
          vault.close()
        },
      )
      .command(
        "write <folder> <title>",
        "Write a note to the vault",
        (yargs) =>
          yargs
            .positional("folder", { type: "string", demandOption: true, describe: "Folder (Daily|People|Projects|Meetings|Topics)" })
            .positional("title", { type: "string", demandOption: true, describe: "Note title" })
            .option("content", { type: "string", default: "", describe: "Note content (Markdown)" })
            .option("tags", { type: "string", describe: "Comma-separated tags" }),
        async (argv) => {
          const vault = new VaultManager()
          await vault.initialize()
          const note = await vault.createNote(
            argv.folder as string,
            argv.title as string,
            (argv.content as string) || "",
            {
              tags: argv.tags ? (argv.tags as string).split(",").map(t => t.trim()) : undefined,
            },
          )
          console.log(`Note written: ${note.relPath}`)
          vault.close()
        },
      )
      .command(
        "sync [source]",
        "Trigger vault sync",
        (yargs) =>
          yargs
            .positional("source", { type: "string", describe: "Source to sync (gmail|calendar|fireflies|all)" })
            .option("lookback", { type: "number", default: 7, describe: "Lookback days" }),
        async (argv) => {
          const vault = new VaultManager()
          await vault.initialize()
          const source = (argv.source as string) || "all"

          if (source === "all") {
            const results = await runAllSyncs(vault)
            for (const r of results) {
              console.log(`${r.source}: ${r.success ? "OK" : "FAIL"} — ${r.itemsSynced} items`)
              if (r.errors.length) console.log(`  Errors: ${r.errors.join("; ")}`)
            }
          } else {
            const result = await runSync(vault, source)
            console.log(`${result.source}: ${result.success ? "OK" : "FAIL"} — ${result.itemsSynced} items`)
            if (result.errors.length) console.log(`  Errors: ${result.errors.join("; ")}`)
          }
          vault.close()
        },
      )
      .command(
        "daily",
        "Open or create today's daily note",
        () => {},
        async () => {
          const vault = new VaultManager()
          await vault.initialize()
          const note = await vault.getDailyNote()
          console.log(`Daily note: ${note.relPath}`)
          console.log(note.content)
          vault.close()
        },
      )
      .command(
        "graph",
        "Rebuild entity graph and create entity notes",
        () => {},
        async () => {
          const vault = new VaultManager()
          await vault.initialize()
          const { buildGraph, ensureEntityNotes } = await import("@/vault/graph/build")
          const notes = (await vault.query({})).notes
          const graph = buildGraph(notes)
          console.log(`Graph: ${graph.nodes.size} nodes, ${graph.edges.length} edges`)
          await ensureEntityNotes(vault.rootPath, notes)
          console.log("Entity notes ensured")
          vault.close()
        },
      )
      .command(
        "live",
        "Update live notes",
        () => {},
        async () => {
          const vault = new VaultManager()
          await vault.initialize()
          const updated = await updateAllLiveNotes(vault)
          console.log(`Updated ${updated} live note(s)`)
          vault.close()
        },
      )
      .command(
        "status",
        "Show vault statistics and connector health",
        () => {},
        async () => {
          const vault = new VaultManager()
          await vault.initialize()
          const all = await vault.query({})
          const byFolder = new Map<string, number>()
          for (const note of all.notes) {
            const folder = note.folder.split("/")[0] || "root"
            byFolder.set(folder, (byFolder.get(folder) || 0) + 1)
          }
          console.log(`Vault path: ${vault.rootPath}`)
          console.log(`Total notes: ${all.total}`)
          console.log("By folder:")
          for (const [folder, count] of byFolder) {
            console.log(`  ${folder}: ${count}`)
          }

          const settings = await loadSettings()
          console.log("\nConnectors:")
          for (const c of listConnectors()) {
            const status = await c.status()
            const enabled = settings.sources[c.meta.id as keyof typeof settings.sources]?.enabled ?? false
            console.log(`  ${c.meta.name} (${c.meta.id}):`)
            console.log(`    Enabled: ${enabled ? "yes" : "no"}`)
            console.log(`    Authenticated: ${status.authenticated ? "yes" : "no"}`)
            if (status.error) console.log(`    Error: ${status.error}`)
          }
          vault.close()
        },
      )
      .command(
        "config",
        "Manage vault configuration and integrations",
        (yargs) =>
          yargs
            .command(
              "show",
              "Show current configuration",
              () => {},
              async () => {
                const settings = await loadSettings()
                console.log(JSON.stringify(settings, null, 2))
              },
            )
            .command(
              "enable <source>",
              "Enable a sync source",
              (yargs) =>
                yargs.positional("source", { type: "string", demandOption: true, describe: "gmail|calendar|fireflies" }),
              async (argv) => {
                await setSourceEnabled(argv.source as any, true)
                console.log(`Source "${argv.source}" enabled`)
                console.log("Run `gizzi vault config auth <source>` to set credentials")
              },
            )
            .command(
              "disable <source>",
              "Disable a sync source",
              (yargs) =>
                yargs.positional("source", { type: "string", demandOption: true, describe: "gmail|calendar|fireflies" }),
              async (argv) => {
                await setSourceEnabled(argv.source as any, false)
                console.log(`Source "${argv.source}" disabled`)
              },
            )
            .command(
              "auth <source>",
              "Configure authentication for a source",
              (yargs) =>
                yargs.positional("source", { type: "string", demandOption: true, describe: "gmail|fireflies|google" }),
              async (argv) => {
                const source = argv.source as string
                if (source === "gmail" || source === "google") {
                  console.log("\nGoogle OAuth Setup:")
                  console.log("1. Go to https://console.cloud.google.com/apis/credentials")
                  console.log("2. Create an OAuth 2.0 Client ID (Desktop app)")
                  console.log("3. Enable Gmail API and Calendar API")
                  console.log("\nEnter your Google OAuth Client ID:")
                  const clientId = await readLine()
                  console.log("Enter your Google OAuth Client Secret:")
                  const clientSecret = await readLine()
                  await setGoogleCredentials(clientId, clientSecret)
                  console.log("\nCredentials saved. Now run:")
                  console.log("  gizzi vault config login google")
                } else if (source === "fireflies") {
                  console.log("\nEnter your Fireflies API Key:")
                  console.log("  (Get one at https://fireflies.ai/settings)")
                  const apiKey = await readLine()
                  await setFirefliesApiKey(apiKey)
                  console.log("Fireflies API key saved")
                } else {
                  console.error(`Unknown auth source: ${source}`)
                  process.exit(1)
                }
              },
            )
            .command(
              "login <source>",
              "Perform OAuth login for a source",
              (yargs) =>
                yargs.positional("source", { type: "string", demandOption: true, describe: "google" }),
              async (argv) => {
                const source = argv.source as string
                if (source === "google") {
                  const settings = await loadSettings()
                  const clientId = settings.sources.gmail.clientId
                  const clientSecret = settings.sources.gmail.clientSecret
                  if (!clientId || !clientSecret) {
                    console.error("Google OAuth credentials not configured. Run:")
                    console.error("  gizzi vault config auth google")
                    process.exit(1)
                  }

                  console.log("\nOpening browser for Google OAuth...")
                  const redirectUri = "http://127.0.0.1:3005/oauth/callback"
                  const scope = encodeURIComponent("https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar.readonly")
                  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`

                  console.log(`If browser doesn't open, visit:\n  ${authUrl}`)
                  console.log("\nPaste the authorization code here:")
                  const code = await readLine()

                  // Exchange code for tokens
                  const response = await fetch("https://oauth2.googleapis.com/token", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                      client_id: clientId,
                      client_secret: clientSecret,
                      code,
                      redirect_uri: redirectUri,
                      grant_type: "authorization_code",
                    }),
                  })

                  if (!response.ok) {
                    console.error("OAuth exchange failed:", await response.text())
                    process.exit(1)
                  }

                  const data = await response.json()
                  await Auth.set("google", {
                    type: "oauth",
                    access: data.access_token,
                    refresh: data.refresh_token,
                    expires: Date.now() + data.expires_in * 1000,
                  })

                  console.log("Google authentication successful!")
                  console.log("You can now enable sync: gizzi vault config enable gmail")
                } else {
                  console.error(`Unknown login source: ${source}`)
                  process.exit(1)
                }
              },
            )
            .command(
              "voice",
              "Configure voice I/O settings",
              (yargs) =>
                yargs
                  .option("deepgram", { type: "string", describe: "Deepgram API key" })
                  .option("elevenlabs", { type: "string", describe: "ElevenLabs API key" })
                  .option("voice-id", { type: "string", describe: "ElevenLabs voice ID" })
                  .option("enable", { type: "boolean", describe: "Enable voice features" })
                  .option("disable", { type: "boolean", describe: "Disable voice features" }),
              async (argv) => {
                const config: any = {}
                if (argv.deepgram) config.deepgramApiKey = argv.deepgram as string
                if (argv.elevenlabs) config.elevenlabsApiKey = argv.elevenlabs as string
                if (argv["voice-id"]) config.elevenlabsVoiceId = argv["voice-id"] as string
                if (argv.enable) config.enabled = true
                if (argv.disable) config.enabled = false
                await setVoiceConfig(config)
                console.log("Voice configuration updated")
              },
            )
            .demandCommand(1),
      )
      .demandCommand(1),
  handler: async () => {},
})
