import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { sensiboExecutors, validateSensiboCredential } from "./runtime.ts";

export const executors: ProviderExecutors = sensiboExecutors;

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSensiboCredential(input.apiKey, fetcher, signal);
  },
};
