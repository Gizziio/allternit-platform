import type { ProviderDefinition } from "../../core/types.ts";

import { shopifyAdminActions } from "./actions.ts";

const service = "shopify_admin";

/**
 * Shopify Admin provider backed by the Shopify Admin GraphQL API.
 */
export const provider: ProviderDefinition = {
  service,
  displayName: "Shopify Admin",
  categories: ["Marketing", "Data"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "Admin API access token",
      placeholder: "shpat_...",
      description:
        "Shopify Admin API access token sent with the X-Shopify-Access-Token header. Create or install a custom app and copy its Admin API access token: https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens",
      extraFields: [
        {
          key: "shopDomain",
          label: "Shop domain",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "acme.myshopify.com",
          description:
            "The store's myshopify.com domain, such as acme.myshopify.com. A Shopify admin URL for the same shop is also accepted.",
        },
      ],
    },
  ],
  homepageUrl: "https://www.shopify.com",
  actions: shopifyAdminActions,
};
