import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { supadataActionHandlers, validateSupadataCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("supadata", supadataActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSupadataCredential(input.apiKey, fetcher, signal);
  },
};
