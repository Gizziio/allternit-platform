import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { terraformActionHandlers, validateTerraformCredential } from "./runtime.ts";

const service = "terraform";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, terraformActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTerraformCredential(input.apiKey, fetcher, signal);
  },
};
