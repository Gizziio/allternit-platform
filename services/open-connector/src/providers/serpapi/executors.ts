import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { serpapiExecutors, validateSerpapiCredential } from "./runtime.ts";

export const executors: ProviderExecutors = serpapiExecutors;

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSerpapiCredential(input.apiKey, fetcher, signal);
  },
};
