import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { avomaActionHandlers, validateAvomaCredential } from "./runtime.ts";

const service = "avoma";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, avomaActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateAvomaCredential(input.apiKey, fetcher, signal);
  },
};
