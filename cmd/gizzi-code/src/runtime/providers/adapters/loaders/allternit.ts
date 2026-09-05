import type { ProviderLoader } from "../../types"

export const allternitLoader: ProviderLoader = async () => {
  return {
    autoload: false,
    options: {
      headers: {
        "allternit-beta":
          "gizzi-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
      },
    },
  }
}
