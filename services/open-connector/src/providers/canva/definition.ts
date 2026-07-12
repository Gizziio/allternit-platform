import type { ProviderDefinition } from "../../core/types.ts";

import { canvaActions, canvaProviderScopes } from "./actions.ts";

const service = "canva";

export const provider: ProviderDefinition = {
  service,
  displayName: "Canva",
  categories: ["Design & Media", "Productivity"],
  authTypes: ["oauth2"],
  auth: [
    {
      type: "oauth2",
      authorizationUrl: "https://www.canva.com/api/oauth/authorize",
      tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
      scopes: [
        canvaProviderScopes.designMetaRead,
        canvaProviderScopes.designContentRead,
        canvaProviderScopes.designContentWrite,
        canvaProviderScopes.assetRead,
        canvaProviderScopes.assetWrite,
        canvaProviderScopes.folderRead,
        canvaProviderScopes.folderWrite,
        canvaProviderScopes.profileRead,
      ],
      tokenEndpointAuthMethod: "client_secret_basic",
      pkce: {
        method: "S256",
      },
    },
  ],
  homepageUrl: "https://www.canva.com",
  actions: canvaActions,
};
