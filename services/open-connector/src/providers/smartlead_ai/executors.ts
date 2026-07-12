import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { smartleadAiActionHandlers, validateSmartleadAiCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("smartlead_ai", smartleadAiActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSmartleadAiCredential(input.apiKey, fetcher, signal);
  },
};
