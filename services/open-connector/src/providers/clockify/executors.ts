import type { CredentialValidationResult, CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { clockifyActionHandlers, validateClockifyCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("clockify", clockifyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }): Promise<CredentialValidationResult> {
    return validateClockifyCredential(input.apiKey, fetcher, signal);
  },
};
