import type { CredentialValidationResult, CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { fusionApiActionHandlers, validateFusionApiCredential } from "./runtime.ts";

const service = "fusion-api";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, fusionApiActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }): Promise<CredentialValidationResult> {
    return validateFusionApiCredential(input.apiKey, fetcher, signal);
  },
};
