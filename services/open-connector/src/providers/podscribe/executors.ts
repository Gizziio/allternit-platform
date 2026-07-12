import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { podscribeActionHandlers, validatePodscribeCredential } from "./runtime.ts";

const service = "podscribe";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, podscribeActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validatePodscribeCredential(input.apiKey, fetcher, signal);
  },
};
