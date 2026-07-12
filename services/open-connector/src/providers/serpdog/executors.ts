import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { serpdogExecutors, validateSerpdogCredential } from "./runtime.ts";

export const executors: ProviderExecutors = serpdogExecutors;

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSerpdogCredential(input.apiKey, fetcher, signal);
  },
};
