// Runway image/video driver (stub — wire API when credentials are available).

import { Auth } from "@/runtime/integrations/auth"
import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

export function driver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      const auth = await Auth.get("runway")
      if (!auth || auth.type !== "api" || !auth.key) {
        throw new Error("Connect Runway in Models & Providers first.")
      }
      // TODO: implement Runway Gen-3 API once endpoint details are known.
      const artifact: MediaArtifact = {
        id: `runway_${Date.now()}`,
        url: "",
        mimeType: input.fps ? "video/mp4" : "image/png",
        metadata: { provider: "runway", prompt: input.prompt, stub: true },
      }
      return { artifacts: [artifact], prompt: input.prompt }
    },
  }
}
