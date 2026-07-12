import type { CredentialValidationResult, CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { timecampActionHandlers, validateTimecampCredential } from "./runtime.ts";

const service = "timecamp";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, timecampActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }): Promise<CredentialValidationResult> {
    return validateTimecampCredential(input.apiKey, fetcher, signal);
  },
};
