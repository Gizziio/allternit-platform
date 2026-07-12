import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { devinActionHandlers, validateDevinCredential } from "./runtime.ts";

const service = "devin";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, devinActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateDevinCredential(input.apiKey, fetcher, signal);
  },
};
