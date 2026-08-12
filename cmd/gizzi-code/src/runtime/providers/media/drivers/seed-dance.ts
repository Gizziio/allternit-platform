// Seed.Dance image/video driver (stub — wire API when credentials are available).

import { Auth } from "@/runtime/integrations/auth"
import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

export function driver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      const auth = await Auth.get("seed-dance")
      if (!auth || auth.type !== "api" || !auth.key) {
        throw new Error("Connect Seed.Dance in Models & Providers first.")
      }
      // TODO: implement Seed.Dance submit + poll once endpoint details are known.
      const artifact: MediaArtifact = {
        id: `seed-dance_${Date.now()}`,
        url: "",
        mimeType: input.fps ? "video/mp4" : "image/png",
        metadata: { provider: "seed-dance", prompt: input.prompt, stub: true },
      }
      return { artifacts: [artifact], prompt: input.prompt }
    },
  }
}
