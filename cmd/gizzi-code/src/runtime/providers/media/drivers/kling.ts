// Kling image/video driver (stub — wire API when credentials are available).

import { Auth } from "@/runtime/integrations/auth"
import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

export function driver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      const auth = await Auth.get("kling")
      if (!auth || auth.type !== "api" || !auth.key) {
        throw new Error("Connect Kling in Models & Providers first.")
      }
      // TODO: implement Kling API once endpoint details are known.
      const artifact: MediaArtifact = {
        id: `kling_${Date.now()}`,
        url: "",
        mimeType: input.fps ? "video/mp4" : "image/png",
        metadata: { provider: "kling", prompt: input.prompt, stub: true },
      }
      return { artifacts: [artifact], prompt: input.prompt }
    },
  }
}
