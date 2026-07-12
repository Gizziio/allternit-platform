import type { ProviderDefinition } from "../../core/types.ts";

import { heygenActions } from "./actions.ts";

const service = "heygen";

/**
 * HeyGen provider backed by the HeyGen REST API.
 */
export const provider: ProviderDefinition = {
  service,
  displayName: "HeyGen",
  categories: ["AI", "Design & Media"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Key",
      placeholder: "HEYGEN_API_KEY",
      description: "HeyGen API key sent with the X-Api-Key header. Create or view API keys in HeyGen API settings.",
    },
  ],
  homepageUrl: "https://www.heygen.com",
  actions: heygenActions,
};
