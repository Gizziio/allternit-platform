import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { cyberimpactActionHandlers, validateCyberimpactCredential } from "./runtime.ts";

const service = "cyberimpact";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, cyberimpactActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateCyberimpactCredential(input.apiKey, fetcher, signal);
  },
};
