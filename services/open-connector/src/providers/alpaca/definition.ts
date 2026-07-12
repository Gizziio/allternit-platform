import type { ProviderDefinition } from "../../core/types.ts";

import { alpacaActions } from "./actions.ts";

const service = "alpaca";

export const provider: ProviderDefinition = {
  service,
  displayName: "Alpaca",
  categories: ["Finance", "Data"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "API Secret Key",
      placeholder: "APCA_API_SECRET_KEY",
      description:
        "Alpaca API secret key sent with the APCA-API-SECRET-KEY header. Generate paper or live API keys from the Alpaca dashboard API Keys page: https://app.alpaca.markets/paper/dashboard/overview",
      extraFields: [
        {
          key: "apiKeyId",
          label: "API Key ID",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "APCA_API_KEY_ID",
          description:
            "Alpaca API key ID sent with the APCA-API-KEY-ID header. Copy it from the same Alpaca dashboard API Keys page as the secret key: https://app.alpaca.markets/paper/dashboard/overview",
        },
        {
          key: "environment",
          label: "Environment",
          inputType: "text",
          required: true,
          secret: false,
          placeholder: "paper",
          description:
            "Alpaca trading environment for this key. Use paper for paper trading keys or live for live trading keys.",
        },
      ],
    },
  ],
  homepageUrl: "https://alpaca.markets/",
  actions: alpacaActions,
};
