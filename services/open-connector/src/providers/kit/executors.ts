import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { kitActionHandlers, validateKitCredential } from "./runtime.ts";

const service = "kit";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, kitActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateKitCredential({
      apiKey: input.apiKey,
      fetcher,
      signal,
    });
  },
};
