import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { lemonSqueezyActionHandlers, validateLemonSqueezyCredential } from "./runtime.ts";

const service = "lemon_squeezy";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, lemonSqueezyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateLemonSqueezyCredential({
      apiKey: input.apiKey,
      fetcher,
      signal,
    });
  },
};
