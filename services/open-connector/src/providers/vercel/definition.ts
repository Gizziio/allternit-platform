import type { ProviderDefinition } from "../../core/types.ts";

import { vercelActions } from "./actions.ts";

const service = "vercel";

/**
 * Vercel provider backed by the Vercel REST API.
 */
export const provider: ProviderDefinition = {
  service,
  displayName: "Vercel",
  categories: ["Developer Tools"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "Access token",
      placeholder: "vercel_access_token",
      description:
        "Vercel personal access token used with the Authorization Bearer header. Create it in your Vercel Account Tokens settings.",
    },
  ],
  homepageUrl: "https://vercel.com",
  actions: vercelActions,
};
