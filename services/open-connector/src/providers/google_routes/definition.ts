import type { ProviderDefinition } from "../../core/types.ts";

import { googleRoutesActions } from "./actions.ts";

const service = "google_routes";

export const provider: ProviderDefinition = {
  service,
  displayName: "Google Routes",
  categories: ["Location", "Developer Tools"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Key",
      placeholder: "GOOGLE_MAPS_API_KEY",
      description:
        "Google Maps Platform API key sent with the X-Goog-Api-Key header. Create or manage it in the Google Cloud Console: https://developers.google.com/maps/documentation/routes/get-api-key",
      extraFields: [],
    },
  ],
  homepageUrl: "https://developers.google.com/maps/documentation/routes",
  actions: googleRoutesActions,
};
