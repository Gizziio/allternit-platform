import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { dailybotActionHandlers, validateDailybotCredential } from "./runtime.ts";

const service = "dailybot";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, dailybotActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateDailybotCredential(input.apiKey, fetcher, signal);
  },
};
