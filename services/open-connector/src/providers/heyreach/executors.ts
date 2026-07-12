import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { heyreachActionHandlers, validateHeyreachCredential } from "./runtime.ts";

const service = "heyreach";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, heyreachActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateHeyreachCredential(input.apiKey, fetcher, signal);
  },
};
