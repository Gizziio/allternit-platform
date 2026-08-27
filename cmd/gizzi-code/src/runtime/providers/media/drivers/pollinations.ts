// Pollinations.ai driver — free, no-auth image and video generation.
// Builds deterministic URLs that the caller can fetch or embed directly.

import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

const IMAGE_BASE = "https://image.pollinations.ai/prompt"
const VIDEO_BASE = "https://video.pollinations.ai/prompt"

function sanitizePrompt(prompt: string): string {
  return encodeURIComponent(prompt.trim())
}

function aspectToSize(aspectRatio?: string): { width: number; height: number } {
  switch (aspectRatio) {
    case "9:16":
      return { width: 576, height: 1024 }
    case "1:1":
      return { width: 1024, height: 1024 }
    case "4:3":
      return { width: 1024, height: 768 }
    case "2:3":
      return { width: 768, height: 1152 }
    case "3:2":
      return { width: 1152, height: 768 }
    case "16:9":
    default:
      return { width: 1024, height: 576 }
  }
}

export function imageDriver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      const size = aspectToSize(input.aspectRatio)
      const width = input.width ?? size.width
      const height = input.height ?? size.height
      const seed = input.seed ?? Math.floor(Math.random() * 1_000_000)
      const params = new URLSearchParams({
        width: String(width),
        height: String(height),
        seed: String(seed),
        nologo: "true",
      })
      if (input.negativePrompt) params.set("negative", sanitizePrompt(input.negativePrompt))
      if (input.style) params.set("style", input.style)
      const url = `${IMAGE_BASE}/${sanitizePrompt(input.prompt)}?${params.toString()}`
      const artifact: MediaArtifact = {
        id: `pollinations-image_${Date.now()}_${seed}`,
        url,
        mimeType: "image/png",
        metadata: {
          provider: "pollinations-image",
          width,
          height,
          seed,
          prompt: input.prompt,
        },
      }
      return { artifacts: [artifact], prompt: input.prompt }
    },
  }
}

export function videoDriver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      const size = aspectToSize(input.aspectRatio)
      const width = input.width ?? size.width
      const height = input.height ?? size.height
      const seed = input.seed ?? Math.floor(Math.random() * 1_000_000)
      const params = new URLSearchParams({
        width: String(width),
        height: String(height),
        seed: String(seed),
        nologo: "true",
      })
      if (input.duration) params.set("duration", String(input.duration))
      if (input.fps) params.set("fps", String(input.fps))
      if (input.style) params.set("style", input.style)
      const url = `${VIDEO_BASE}/${sanitizePrompt(input.prompt)}?${params.toString()}`
      const artifact: MediaArtifact = {
        id: `pollinations-video_${Date.now()}_${seed}`,
        url,
        mimeType: "video/mp4",
        metadata: {
          provider: "pollinations-video",
          width,
          height,
          seed,
          duration: input.duration ?? 6,
          fps: input.fps ?? 24,
          prompt: input.prompt,
        },
      }
      return { artifacts: [artifact], prompt: input.prompt }
    },
  }
}
