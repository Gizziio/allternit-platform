import type { ProviderLoader } from "../../types"

export const openaiLoader: ProviderLoader = async () => {
  return {
    autoload: false,
    async getModel(sdk: any, modelID: string, _options?: Record<string, any>) {
      return sdk.responses(modelID)
    },
    options: {},
  }
}
