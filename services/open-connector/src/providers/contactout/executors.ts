import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { contactoutActionHandlers, validateContactoutCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("contactout", contactoutActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateContactoutCredential(input.apiKey, fetcher, signal);
  },
};
