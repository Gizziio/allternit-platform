// NanoBanana image driver (stub — wire API when credentials are available).

import { Auth } from "@/runtime/integrations/auth"
import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

export function driver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      const auth = await Auth.get("nano-banana")
      if (!auth || auth.type !== "api" || !auth.key) {
        throw new Error("Connect NanoBanana in Models & Providers first.")
      }
      // TODO: implement NanoBanana submit + poll once endpoint details are known.
      const artifact: MediaArtifact = {
        id: `nano-banana_${Date.now()}`,
        url: "",
        mimeType: "image/png",
        metadata: { provider: "nano-banana", prompt: input.prompt, stub: true },
      }
      return { artifacts: [artifact], prompt: input.prompt }
    },
  }
}
