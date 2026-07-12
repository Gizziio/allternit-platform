import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { censysActionHandlers, validateCensysCredential } from "./runtime.ts";

const service = "censys";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, censysActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateCensysCredential(input.apiKey, fetcher, signal);
  },
};
