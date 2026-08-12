// Pika image/video driver (stub — wire API when credentials are available).

import { Auth } from "@/runtime/integrations/auth"
import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

export function driver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      const auth = await Auth.get("pika")
      if (!auth || auth.type !== "api" || !auth.key) {
        throw new Error("Connect Pika in Models & Providers first.")
      }
      // TODO: implement Pika API once endpoint details are known.
      const artifact: MediaArtifact = {
        id: `pika_${Date.now()}`,
        url: "",
        mimeType: input.fps ? "video/mp4" : "image/png",
        metadata: { provider: "pika", prompt: input.prompt, stub: true },
      }
      return { artifacts: [artifact], prompt: input.prompt }
    },
  }
}
