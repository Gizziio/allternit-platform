import type { ProviderDefinition } from "../../core/types.ts";

import { attioActions } from "./actions.ts";

const service = "attio";

export const provider: ProviderDefinition = {
  service,
  displayName: "Attio",
  categories: ["Productivity", "Data"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "Access Token",
      placeholder: "ATTIO_ACCESS_TOKEN",
      description:
        "Attio access token sent as a Bearer token. Create or copy a token from the Attio developer dashboard: https://build.attio.com/.",
      extraFields: [],
    },
  ],
  homepageUrl: "https://attio.com",
  actions: attioActions,
};
