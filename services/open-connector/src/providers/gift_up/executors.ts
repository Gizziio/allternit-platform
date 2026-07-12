import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { giftUpActionHandlers, validateGiftUpCredential } from "./runtime.ts";

const service = "gift_up";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, giftUpActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateGiftUpCredential,
};
