// Media generation provider registry.
// Keeps image/video/website generation separate from LLM providers so the
// auth model and dispatch pipeline can be simple and deterministic.

import z from "zod/v4"

export const MediaAuthType = z.enum(["none", "api_key", "subprocess", "mcp"])
export type MediaAuthType = z.infer<typeof MediaAuthType>

export const MediaMode = z.enum(["image", "video", "website", "slides", "sheets", "doc"])
export type MediaMode = z.infer<typeof MediaMode>

export const MediaProvider = z.object({
  id: z.string(),
  name: z.string(),
  modes: z.array(MediaMode),
  authType: MediaAuthType,
  description: z.string().optional(),
  // For api_key providers: which providerID key is read from Auth.get()
  authProviderID: z.string().optional(),
  // For subprocess providers: command to check availability
  binary: z.string().optional(),
  // For mcp providers: mcp server name / config key
  mcpServer: z.string().optional(),
  // Whether the provider is available on this machine right now
  available: z.boolean().optional(),
  // Estimated cost tier or free label
  tier: z.enum(["free", "cheap", "standard", "premium"]).optional(),
})
export type MediaProvider = z.infer<typeof MediaProvider>

export const MediaGenerateInput = z.object({
  prompt: z.string().min(1).max(20_000),
  // Provider-specific model name
  model: z.string().optional(),
  // Image/video shape
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  aspectRatio: z.enum(["16:9", "9:16", "1:1", "4:3", "3:2", "2:3"]).optional(),
  // Video length
  duration: z.number().int().min(1).max(60).optional(),
  fps: z.number().int().min(1).max(120).optional(),
  resolution: z.enum(["480p", "720p", "768p", "1080p", "1440p", "4k"]).optional(),
  // Generic quality/style knobs
  quality: z.enum(["low", "medium", "high", "ultra"]).optional(),
  style: z.string().optional(),
  negativePrompt: z.string().optional(),
  seed: z.number().int().optional(),
  // Website/slides/doc/sheets payload (markdown, json, etc)
  content: z.record(z.string(), z.any()).optional(),
  // Number of variants to generate
  n: z.number().int().min(1).max(4).optional(),
})
export type MediaGenerateInput = z.infer<typeof MediaGenerateInput>

export const MediaArtifact = z.object({
  id: z.string(),
  url: z.string().optional(),
  data: z.string().optional(),
  mimeType: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
})
export type MediaArtifact = z.infer<typeof MediaArtifact>

export const MediaGenerateResult = z.object({
  artifacts: z.array(MediaArtifact),
  prompt: z.string(),
  config: z.record(z.string(), z.any()).optional(),
})
export type MediaGenerateResult = z.infer<typeof MediaGenerateResult>

export interface MediaDriver {
  generate(input: MediaGenerateInput): Promise<MediaGenerateResult>
}
