import type { ProviderDefinition } from "../../core/types.ts";

import { confluenceActions } from "./actions.ts";

const service = "confluence";

export const provider: ProviderDefinition = {
  service,
  displayName: "Confluence",
  categories: ["Productivity"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Token",
      placeholder: "ATLASSIAN_API_TOKEN",
      description:
        "Atlassian API token used as the Basic Auth password for Confluence Cloud. Create tokens at https://id.atlassian.com/manage-profile/security/api-tokens.",
      extraFields: [
        {
          key: "email",
          label: "Atlassian Email",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "name@example.com",
          description: "Atlassian account email used as the Basic Auth username for Confluence Cloud.",
        },
        {
          key: "siteUrl",
          label: "Confluence Site URL",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "https://example.atlassian.net",
          description: "Confluence Cloud site URL used to build https://<site>.atlassian.net/wiki/api/v2 requests.",
        },
      ],
    },
  ],
  homepageUrl: "https://www.atlassian.com/software/confluence",
  actions: confluenceActions,
};
