import type { ProviderDefinition } from "../../core/types.ts";

import { pandadocActions } from "./actions.ts";

export const provider: ProviderDefinition = {
  service: "pandadoc",
  displayName: "PandaDoc",
  categories: ["Productivity", "Communication"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Key",
      placeholder: "pandadoc_api_key",
      description:
        "PandaDoc API key used with the Authorization: API-Key <token> header. Generate Sandbox or Production keys in Dev Center > Configuration.",
      extraFields: [],
    },
  ],
  homepageUrl: "https://www.pandadoc.com",
  actions: pandadocActions,
};
