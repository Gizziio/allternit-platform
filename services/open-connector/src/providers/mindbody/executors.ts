import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { mindbodyActionHandlers, validateMindbodyCredential } from "./runtime.ts";

const service = "mindbody";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, mindbodyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMindbodyCredential(input.apiKey, fetcher, signal);
  },
};
