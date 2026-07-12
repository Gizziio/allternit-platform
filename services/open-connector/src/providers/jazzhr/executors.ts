import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { jazzhrActionHandlers, validateJazzhrCredential } from "./runtime.ts";

const service = "jazzhr";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, jazzhrActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateJazzhrCredential(input.apiKey, fetcher, signal);
  },
};
