import type { CredentialValidationResult, CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { cloudconvertActionHandlers, validateCloudconvertCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("cloudconvert", cloudconvertActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }): Promise<CredentialValidationResult> {
    return validateCloudconvertCredential(input.apiKey, fetcher, signal);
  },
};
