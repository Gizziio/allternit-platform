import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { gigasheetActionHandlers, validateGigasheetCredential } from "./runtime.ts";

const service = "gigasheet";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, gigasheetActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateGigasheetCredential(input, fetcher, signal);
  },
};
