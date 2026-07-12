import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { sunoapiActionHandlers, validateSunoApiCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("sunoapi", sunoapiActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSunoApiCredential(input.apiKey, fetcher, signal);
  },
};
