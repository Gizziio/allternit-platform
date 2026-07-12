import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { attentionActionHandlers, validateAttentionCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("attention", attentionActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateAttentionCredential(input.apiKey, fetcher, signal);
  },
};
