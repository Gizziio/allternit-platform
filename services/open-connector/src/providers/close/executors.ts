import type { CredentialValidationResult, CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { closeActionHandlers, validateCloseCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("close", closeActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }): Promise<CredentialValidationResult> {
    return validateCloseCredential(input.apiKey, fetcher, signal);
  },
};
