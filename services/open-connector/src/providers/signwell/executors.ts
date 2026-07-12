import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { signwellActionHandlers, validateSignwellCredential } from "./runtime.ts";

const service = "signwell";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, signwellActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSignwellCredential(input.apiKey, fetcher, signal);
  },
};
