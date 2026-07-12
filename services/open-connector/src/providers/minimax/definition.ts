import type { ProviderDefinition } from "../../core/types.ts";

import { minimaxActions } from "./actions.ts";

const service = "minimax";

export const provider: ProviderDefinition = {
  service,
  displayName: "MiniMax",
  categories: ["AI"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Key",
      placeholder: "MINIMAX_API_KEY",
      description:
        "MiniMax API key sent as an Authorization Bearer token. Create or view API keys in Account Management > API Keys: https://platform.minimax.io/user-center/basic-information/interface-key.",
    },
  ],
  homepageUrl: "https://www.minimax.io",
  actions: minimaxActions,
};
