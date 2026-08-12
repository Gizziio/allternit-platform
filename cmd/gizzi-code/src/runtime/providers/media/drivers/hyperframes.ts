// HyperFrames video driver (stub — wire API when credentials are available).

import { Auth } from "@/runtime/integrations/auth"
import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

export function driver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      const auth = await Auth.get("hyperframes")
      if (!auth || auth.type !== "api" || !auth.key) {
        throw new Error("Connect HyperFrames in Models & Providers first.")
      }
      // TODO: implement HyperFrames API once endpoint details are known.
      const artifact: MediaArtifact = {
        id: `hyperframes_${Date.now()}`,
        url: "",
        mimeType: "video/mp4",
        metadata: { provider: "hyperframes", prompt: input.prompt, stub: true },
      }
      return { artifacts: [artifact], prompt: input.prompt }
    },
  }
}
