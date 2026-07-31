// Publish self-contained, deterministic HTML artifacts to allternit-api
// canvases (docs/HTML_ARTIFACTS_PHASE_1_NOTES.md has the backend contract).
// Named `html-artifact` to avoid colliding with the unrelated `/artifact`
// TUI markdown viewer (src/cli/ui/ink-app/commands/artifact/) and the
// `Artifact` chat-tag type (src/runtime/util/artifacts.ts) — see
// docs/HTML_ARTIFACTS_PHASE_2_NOTES.md for why.
import type { Argv } from "yargs"
import { randomUUID } from "node:crypto"
import { cmd } from "@/cli/commands/cmd"
import { Filesystem } from "@/runtime/util/filesystem"
import { generateArtifactHtml } from "@/runtime/artifacts/generateHtml"
import { loadArtifactConfig, saveArtifactConfig, slugify, type ArtifactConfig } from "@/runtime/artifacts/config"
import type { ArtifactInput } from "@/runtime/artifacts/types"
import {
  getAllternitApiConfigWithDeviceToken,
  publishApiCanvas,
  getApiCanvas,
} from "@/runtime/services/api/allternitApi"

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString("utf8")
}

async function loadInputArg(path: string): Promise<ArtifactInput> {
  const raw = path === "-" ? await readStdin() : await Filesystem.readText(path)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    throw new Error(`--input did not contain valid JSON: ${err instanceof Error ? err.message : String(err)}`)
  }
  return parsed as ArtifactInput
}

export const HtmlArtifactPublishCommand = cmd({
  command: "publish",
  describe: "generate HTML from structured input and publish/redeploy it as a canvas artifact",
  builder: (yargs: Argv) =>
    yargs
      .option("input", {
        type: "string",
        describe:
          "path to a JSON file matching ArtifactInput (title/subtitle/status/tabs — see runtime/artifacts/types.ts), or '-' to read JSON from stdin. Omit to redeploy --key with its last-saved input unchanged.",
      })
      .option("key", {
        type: "string",
        describe:
          "stable artifact_key used to redeploy-in-place. Defaults to a slug of the title. Must stay IDENTICAL across redeploys of the same artifact, or a redeploy will publish as a new one instead of updating.",
      }),
  handler: async (args: { input?: string; key?: string }) => {
    let input: ArtifactInput
    let slug = args.key

    if (args.input) {
      input = await loadInputArg(args.input)
    } else {
      if (!slug) {
        throw new Error(
          "Pass --input <file.json> to publish a new artifact, or --key <slug> to redeploy a previously published one with its saved input.",
        )
      }
      const existing = await loadArtifactConfig(slug)
      if (!existing) {
        throw new Error(`No saved config for artifact key "${slug}" — pass --input <file.json> the first time you publish it.`)
      }
      input = existing.input
    }

    if (!input || typeof input.title !== "string" || !Array.isArray(input.tabs)) {
      throw new Error("ArtifactInput must have a string `title` and an array `tabs` — see runtime/artifacts/types.ts")
    }

    slug = slug ?? slugify(input.title)

    const html = generateArtifactHtml(input)

    const existingConfig = await loadArtifactConfig(slug)
    // Minted once and reused forever after: the (session_id, artifact_key)
    // pair is allternit-api's upsert identity, so this has to stay stable
    // across every redeploy of this artifact_key (see PHASE_2_NOTES.md).
    const sessionId = existingConfig?.sessionId ?? randomUUID()

    const apiConfig = await getAllternitApiConfigWithDeviceToken()
    const response = await publishApiCanvas(apiConfig, sessionId, {
      title: input.title,
      components: [{ type: "artifact", kind: "html", title: input.title, content: html }],
      artifact_key: slug,
    })

    const config: ArtifactConfig = {
      configVersion: 1,
      artifactKey: slug,
      sessionId,
      canvasId: response.id,
      lastPublishedVersion: response.version,
      lastPublishedAt: new Date().toISOString(),
      input,
    }
    await saveArtifactConfig(slug, config)

    const isRedeploy = response.version > 1
    process.stdout.write(
      `${isRedeploy ? "Redeployed" : "Published"} "${input.title}" as "${slug}" — canvas ${response.id}, version ${response.version}.\n`,
    )
    process.stdout.write(`Saved to .gizzi/artifacts/${slug}/config.json\n`)
  },
})

export const HtmlArtifactStatusCommand = cmd({
  command: "status",
  describe: "show the last known publish state for an artifact key",
  builder: (yargs: Argv) =>
    yargs.option("key", {
      type: "string",
      demandOption: true,
      describe: "artifact_key to check (same value passed to `publish --key`)",
    }),
  handler: async (args: { key: string }) => {
    const config = await loadArtifactConfig(args.key)
    if (!config) {
      process.stdout.write(`No local config for artifact key "${args.key}".\n`)
      process.exitCode = 1
      return
    }
    if (!config.canvasId) {
      process.stdout.write(`"${args.key}" has local config but was never successfully published (no canvas id saved).\n`)
      return
    }
    const apiConfig = await getAllternitApiConfigWithDeviceToken()
    const canvas = await getApiCanvas(apiConfig, config.canvasId)
    process.stdout.write(
      `${args.key}: canvas ${canvas.id}, version ${canvas.version}, session ${canvas.session_id}, updated_at ${canvas.updated_at}\n`,
    )
  },
})

export const HtmlArtifactCommand = cmd({
  command: "html-artifact",
  describe: "generate and publish self-contained HTML artifacts (deterministic generator + allternit-api canvas publish)",
  builder: (yargs: Argv) =>
    yargs.command(HtmlArtifactPublishCommand).command(HtmlArtifactStatusCommand).demandCommand(),
  async handler() {},
})
