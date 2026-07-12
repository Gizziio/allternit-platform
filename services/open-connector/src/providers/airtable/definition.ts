import type { ProviderDefinition } from "../../core/types.ts";

import { airtableActions } from "./actions.ts";

const service = "airtable";

/**
 * Airtable provider backed by Airtable Web API personal access tokens.
 */
export const provider: ProviderDefinition = {
  service,
  displayName: "Airtable",
  categories: ["Productivity", "Data"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "Personal Access Token",
      placeholder: "patXXXXXXXXXXXXXX",
      description:
        "Airtable personal access token used with the Authorization Bearer header. Create it in the Airtable developer hub at https://airtable.com/create/tokens.",
      extraFields: [],
    },
  ],
  homepageUrl: "https://airtable.com",
  actions: airtableActions,
};
