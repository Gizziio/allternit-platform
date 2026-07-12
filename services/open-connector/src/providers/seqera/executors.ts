import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineSeqeraExecutors, validateSeqeraCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineSeqeraExecutors();

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSeqeraCredential(input, fetcher, signal);
  },
};
