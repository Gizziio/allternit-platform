import type { ProviderDefinition } from "../../core/types.ts";

import { oktaActions } from "./actions.ts";

const service = "okta";

export const provider: ProviderDefinition = {
  service,
  displayName: "Okta",
  description: "Manage Okta directory users, groups, memberships, and user lifecycle operations.",
  categories: ["Security"],
  authTypes: ["custom_credential"],
  auth: [
    {
      type: "custom_credential",
      fields: [
        {
          key: "orgUrl",
          label: "Org URL",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "https://example.okta.com",
          description:
            "The HTTPS base URL for your Okta organization, such as https://example.okta.com or your configured Okta custom domain.",
        },
        {
          key: "apiToken",
          label: "API Token",
          inputType: "password",
          required: true,
          secret: true,
          placeholder: "OKTA_API_TOKEN",
          description:
            "Okta API token sent with the Authorization: SSWS header. Create it in the Admin Console under Security > API > Tokens: https://developer.okta.com/docs/guides/create-an-api-token/main/.",
        },
      ],
      testAction: {
        actionName: "list_users",
        input: { limit: 1 },
      },
    },
  ],
  homepageUrl: "https://www.okta.com/",
  actions: oktaActions,
};
