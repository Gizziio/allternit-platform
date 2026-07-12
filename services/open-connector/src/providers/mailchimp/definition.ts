import type { ProviderDefinition } from "../../core/types.ts";

import { mailchimpActions } from "./actions.ts";

const service = "mailchimp";

export const provider: ProviderDefinition = {
  service,
  displayName: "Mailchimp",
  categories: ["Communication", "Marketing"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Key",
      placeholder: "0123456789abcdef-us1",
      description:
        "Mailchimp Marketing API key used with HTTP Basic auth. Generate it under Profile > Extras > API keys: https://mailchimp.com/help/about-api-keys/.",
    },
  ],
  homepageUrl: "https://mailchimp.com",
  actions: mailchimpActions,
};
