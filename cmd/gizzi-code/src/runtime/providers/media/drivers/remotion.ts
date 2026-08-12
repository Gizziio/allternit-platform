// Remotion local video pipeline driver.
// Requires a Remotion project/template and the `npx remotion` CLI.

import type { MediaDriver, MediaGenerateInput, MediaGenerateResult, MediaArtifact } from "../types"

export function driver(): MediaDriver {
  return {
    async generate(input: MediaGenerateInput): Promise<MediaGenerateResult> {
      // TODO: wire to a Remotion template project and render via subprocess.
      // For now, surface a clear setup message instead of failing silently.
      const artifact: MediaArtifact = {
        id: `remotion_${Date.now()}`,
        url: "",
        mimeType: "video/mp4",
        metadata: {
          provider: "remotion",
          prompt: input.prompt,
          stub: true,
          setup: "Install a Remotion project and set REMOTION_TEMPLATE_PATH to enable local renders.",
        },
      }
      return { artifacts: [artifact], prompt: input.prompt }
    },
  }
}
