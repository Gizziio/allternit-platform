import type { ProviderDefinition } from "../../core/types.ts";

import { tikhubActions } from "./actions.ts";

export const provider: ProviderDefinition = {
  service: "tikhub",
  displayName: "TikHub",
  categories: ["Data", "Social"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Token",
      placeholder: "tikhub_api_token",
      description:
        "TikHub API token sent with the Authorization: Bearer header. Create it in the TikHub API key dashboard and grant only the platform path scopes needed by your actions.",
    },
  ],
  homepageUrl: "https://tikhub.io/",
  actions: tikhubActions,
};
