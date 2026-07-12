import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { cardlyActionHandlers, validateCardlyCredential } from "./runtime.ts";

const service = "cardly";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, cardlyActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateCardlyCredential(input.apiKey, fetcher, signal);
  },
};
