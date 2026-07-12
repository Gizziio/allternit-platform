import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { contentfulActionHandlers, validateContentfulCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("contentful", contentfulActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateContentfulCredential(input.apiKey, fetcher, signal);
  },
};
