import type { ProviderDefinition } from "../../core/types.ts";

import { cursorActions } from "./actions.ts";

const service = "cursor";

export const provider: ProviderDefinition = {
  service,
  displayName: "Cursor",
  categories: ["Developer Tools", "AI"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Key",
      placeholder: "crsr_...",
      description:
        "Cursor API key sent with Basic authentication. Create or copy a key from Cursor Dashboard > API Keys: https://cursor.com/dashboard/api",
    },
  ],
  homepageUrl: "https://cursor.com",
  actions: cursorActions,
};
