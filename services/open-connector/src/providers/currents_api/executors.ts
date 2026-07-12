import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { currentsApiActionHandlers, validateCurrentsApiCredential } from "./runtime.ts";

const service = "currents_api";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, currentsApiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateCurrentsApiCredential(input.apiKey, fetcher, signal);
  },
};
