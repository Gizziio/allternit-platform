import type { ProviderDefinition } from "../../core/types.ts";

import { telegramActions } from "./actions.ts";

export const provider: ProviderDefinition = {
  service: "telegram",
  displayName: "Telegram Bot",
  categories: ["Communication", "Social"],
  authTypes: ["api_key"],
  auth: [
    {
      type: "api_key",
      label: "Bot Token",
      placeholder: "123456789:AA...",
      description:
        "Create a new bot with @BotFather using /newbot, then paste the generated token here. Telegram documents BotFather at https://core.telegram.org/bots/features#botfather.",
    },
  ],
  homepageUrl: "https://core.telegram.org/bots",
  actions: telegramActions,
};
