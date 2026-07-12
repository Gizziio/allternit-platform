import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { eveniumActionHandlers, validateEveniumCredential } from "./runtime.ts";

const service = "evenium";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, eveniumActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateEveniumCredential(input.apiKey, fetcher, signal);
  },
};
