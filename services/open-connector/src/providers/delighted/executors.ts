import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { delightedActionHandlers, validateDelightedCredential } from "./runtime.ts";

const service = "delighted";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, delightedActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateDelightedCredential(input.apiKey, fetcher, signal);
  },
};
