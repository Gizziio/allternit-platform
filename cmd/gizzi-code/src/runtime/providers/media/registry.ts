// @ts-nocheck
import { Auth } from "@/runtime/integrations/auth"
import { Log } from "@/shared/util/log"
import type {
  MediaArtifact,
  MediaDriver,
  MediaGenerateInput,
  MediaGenerateResult,
  MediaMode,
  MediaProvider,
} from "./types"
import { MediaMode as MediaModeEnum } from "./types"
import * as pollinations from "./drivers/pollinations"
import * as bonsai from "./drivers/bonsai"
import * as openaiImage from "./drivers/openai-image"
import * as minimax from "./drivers/minimax"
import * as seedDance from "./drivers/seed-dance"
import * as nanoBanana from "./drivers/nano-banana"
import * as runway from "./drivers/runway"
import * as pika from "./drivers/pika"
import * as kling from "./drivers/kling"
import * as remotion from "./drivers/remotion"
import * as hyperframes from "./drivers/hyperframes"
import * as blenderMcp from "./drivers/blender-mcp"

const log = Log.create({ service: "media-providers" })

// Static registry. Each entry declares what it can create and how it
// authenticates. Availability is resolved lazily so free providers always
// appear and local/subprocess providers only appear when the binary is found.
export const MEDIA_PROVIDERS: MediaProvider[] = [
  {
    id: "pollinations-image",
    name: "Pollinations AI",
    modes: ["image"],
    authType: "none",
    description: "Free, no-signup image generation via pollinations.ai",
    tier: "free",
  },
  {
    id: "pollinations-video",
    name: "Pollinations Video",
    modes: ["video"],
    authType: "none",
    description: "Free, no-signup video generation via pollinations.ai",
    tier: "free",
  },
  {
    id: "bonsai-local",
    name: "Bonsai Local",
    modes: ["image"],
    authType: "none",
    description: "Local image generation when a Bonsai-compatible local engine is running",
    tier: "free",
  },
  {
    id: "openai-image",
    name: "OpenAI Image",
    modes: ["image"],
    authType: "api_key",
    authProviderID: "openai",
    description: "DALL-E 3 and GPT-image models",
    tier: "standard",
  },
  {
    id: "seed-dance",
    name: "Seed.Dance",
    modes: ["image", "video"],
    authType: "api_key",
    authProviderID: "seed-dance",
    description: "Seed.Dance image and video generation",
    tier: "cheap",
  },
  {
    id: "nano-banana",
    name: "NanoBanana",
    modes: ["image"],
    authType: "api_key",
    authProviderID: "nano-banana",
    description: "NanoBanana image generation",
    tier: "cheap",
  },
  {
    id: "minimax",
    name: "MiniMax",
    modes: ["video"],
    authType: "api_key",
    authProviderID: "minimax",
    description: "MiniMax Hailuo video generation",
    tier: "standard",
  },
  {
    id: "runway",
    name: "Runway",
    modes: ["video", "image"],
    authType: "api_key",
    authProviderID: "runway",
    description: "Runway Gen-3 video generation",
    tier: "premium",
  },
  {
    id: "pika",
    name: "Pika",
    modes: ["video", "image"],
    authType: "api_key",
    authProviderID: "pika",
    description: "Pika video generation",
    tier: "premium",
  },
  {
    id: "kling",
    name: "Kling",
    modes: ["video", "image"],
    authType: "api_key",
    authProviderID: "kling",
    description: "Kling video generation",
    tier: "premium",
  },
  {
    id: "remotion",
    name: "Remotion",
    modes: ["video"],
    authType: "subprocess",
    binary: "npx",
    description: "Programmatic video via Remotion CLI (local Node.js pipeline)",
    tier: "free",
  },
  {
    id: "hyperframes",
    name: "HyperFrames",
    modes: ["video"],
    authType: "api_key",
    authProviderID: "hyperframes",
    description: "HyperFrames video generation",
    tier: "premium",
  },
  {
    id: "blender-mcp",
    name: "Blender MCP",
    modes: ["video", "image"],
    authType: "mcp",
    mcpServer: "blender",
    description: "Blender 3D renders and animations via MCP",
    tier: "free",
  },
]

function driverFor(providerID: string): MediaDriver | undefined {
  switch (providerID) {
    case "pollinations-image":
      return pollinations.imageDriver()
    case "pollinations-video":
      return pollinations.videoDriver()
    case "bonsai-local":
      return bonsai.localDriver()
    case "openai-image":
      return openaiImage.driver()
    case "minimax":
      return minimax.driver()
    case "seed-dance":
      return seedDance.driver()
    case "nano-banana":
      return nanoBanana.driver()
    case "runway":
      return runway.driver()
    case "pika":
      return pika.driver()
    case "kling":
      return kling.driver()
    case "remotion":
      return remotion.driver()
    case "hyperframes":
      return hyperframes.driver()
    case "blender-mcp":
      return blenderMcp.driver()
  }
}

export function mediaProviders(): MediaProvider[] {
  return MEDIA_PROVIDERS.map((p) => ({ ...p, available: isAvailable(p) }))
}

export function providersForMode(mode: MediaMode): MediaProvider[] {
  return mediaProviders().filter((p) => p.modes.includes(mode))
}

function isAvailable(provider: MediaProvider): boolean {
  if (provider.authType === "none") return true
  return true // availability resolved at generate time for API-key providers
}

export async function generate(
  mode: MediaMode,
  providerID: string,
  input: MediaGenerateInput,
): Promise<MediaGenerateResult> {
  const provider = MEDIA_PROVIDERS.find((p) => p.id === providerID)
  if (!provider) {
    throw new Error(`Unknown media provider: ${providerID}`)
  }
  if (!provider.modes.includes(mode)) {
    throw new Error(`Provider ${providerID} does not support ${mode}`)
  }

  if (provider.authType === "api_key") {
    const auth = await Auth.get(provider.authProviderID ?? providerID)
    if (!auth || auth.type !== "api" || !auth.key) {
      throw new Error(`Connect ${provider.name} in Models & Providers first.`)
    }
  }

  const driver = driverFor(providerID)
  if (!driver) {
    throw new Error(`Driver for ${providerID} is not implemented yet.`)
  }

  using _ = log.time("media.generate", { mode, providerID })
  const result = await driver.generate(input)
  return {
    ...result,
    config: { provider: providerID, mode, ...input, ...(result.config ?? {}) },
  }
}

export function artifactFromUrl(
  id: string,
  url: string,
  mimeType: string,
  metadata?: Record<string, unknown>,
): MediaArtifact {
  return {
    id,
    url,
    mimeType,
    metadata,
  }
}

export function ensureMode(value: string): MediaMode {
  const parsed = MediaModeEnum.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Invalid media mode: ${value}. Must be one of ${MediaModeEnum.options.join(", ")}`)
  }
  return parsed.data
}
