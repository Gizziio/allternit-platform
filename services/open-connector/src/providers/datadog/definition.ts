import type { ProviderDefinition } from "../../core/types.ts";

import { datadogActions } from "./actions.ts";

const service = "datadog";

/**
 * Datadog provider backed by Datadog API and application keys.
 */
export const provider: ProviderDefinition = {
  service,
  displayName: "Datadog",
  categories: ["Developer Tools", "Data"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Key",
      placeholder: "DATADOG_API_KEY",
      description:
        "Datadog API key used for API requests. Create or view API keys in Organization Settings: https://docs.datadoghq.com/account_management/api-app-keys/",
      extraFields: [
        {
          key: "applicationKey",
          label: "Application Key",
          inputType: "password",
          required: true,
          secret: true,
          placeholder: "DATADOG_APPLICATION_KEY",
          description:
            "Datadog application key required for read API requests. Create or view application keys in Organization Settings: https://docs.datadoghq.com/account_management/api-app-keys/",
        },
        {
          key: "site",
          label: "Datadog Site",
          inputType: "text",
          required: false,
          secret: false,
          placeholder: "us1",
          description: "Datadog site for the account. Use one of us1, us3, us5, eu, ap1, ap2, gov, or gov2.",
        },
      ],
    },
  ],
  homepageUrl: "https://www.datadoghq.com/",
  actions: datadogActions,
};
