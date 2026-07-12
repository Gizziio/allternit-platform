import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { catsActionHandlers, validateCatsCredential } from "./runtime.ts";

const service = "cats";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, catsActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateCatsCredential(input.apiKey, fetcher, signal);
  },
};
