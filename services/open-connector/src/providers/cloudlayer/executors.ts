import type { CredentialValidationResult, CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { cloudlayerActionHandlers, validateCloudlayerCredential } from "./runtime.ts";

const service = "cloudlayer";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, cloudlayerActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }): Promise<CredentialValidationResult> {
    return validateCloudlayerCredential(input.apiKey, fetcher, signal);
  },
};
