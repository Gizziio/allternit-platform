import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { bunnycdnActionHandlers, validateBunnycdnCredential } from "./runtime.ts";

const service = "bunnycdn";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, bunnycdnActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBunnycdnCredential(input.apiKey, fetcher, signal);
  },
};
