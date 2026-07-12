import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { aivoovActionHandlers, validateAivoovCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("aivoov", aivoovActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateAivoovCredential(input.apiKey, fetcher, signal);
  },
};
