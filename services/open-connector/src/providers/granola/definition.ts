import type { ProviderDefinition } from "../../core/types.ts";

import { granolaActions } from "./actions.ts";

const service = "granola";

export const provider: ProviderDefinition = {
  service,
  displayName: "Granola",
  categories: ["AI", "Productivity"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Key",
      placeholder: "granola_api_key",
      description:
        "Granola API key used as a bearer token. Create or view keys from Granola Settings > Integrations > Granola API: https://docs.granola.ai/help-center/sharing/integrations/granola-api.",
    },
  ],
  homepageUrl: "https://www.granola.ai",
  actions: granolaActions,
};
