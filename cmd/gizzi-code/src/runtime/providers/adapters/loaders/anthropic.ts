import type { ProviderLoader } from "../../types"

export const anthropicLoader: ProviderLoader = async () => {
  return {
    autoload: false,
    options: {
      headers: {
        "anthropic-beta":
          "claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
      },
    },
  }
}
