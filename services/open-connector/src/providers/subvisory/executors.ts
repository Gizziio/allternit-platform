import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { subvisoryActionHandlers, validateSubvisoryCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("subvisory", subvisoryActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSubvisoryCredential(input.apiKey, fetcher, signal);
  },
};
