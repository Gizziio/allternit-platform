// OpenAI DALL-E / GPT-image driver.

import { Auth } from "@/runtime/integrations/auth"
import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

export function driver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      const auth = await Auth.get("openai")
      if (!auth || auth.type !== "api" || !auth.key) {
        throw new Error("Connect OpenAI in Models & Providers first.")
      }

      const size = input.width && input.height ? `${input.width}x${input.height}` : "1024x1024"
      const model = input.model ?? "dall-e-3"
      const n = Math.min(input.n ?? 1, model.startsWith("dall-e-3") ? 1 : 4)

      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt: input.prompt,
          n,
          size,
          quality: input.quality === "ultra" ? "hd" : input.quality ?? "standard",
          style: input.style === "natural" || input.style === "vivid" ? input.style : "vivid",
          response_format: "url",
        }),
      })

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}))
        throw new Error(detail.error?.message || `OpenAI image generation failed: ${response.statusText}`)
      }

      const body = (await response.json()) as { data: Array<{ url: string; revised_prompt?: string }> }
      const artifacts: MediaArtifact[] = body.data.map((item, index) => ({
        id: `openai-image_${Date.now()}_${index}`,
        url: item.url,
        mimeType: "image/png",
        metadata: {
          provider: "openai-image",
          model,
          size,
          prompt: item.revised_prompt ?? input.prompt,
        },
      }))

      return { artifacts, prompt: input.prompt }
    },
  }
}
