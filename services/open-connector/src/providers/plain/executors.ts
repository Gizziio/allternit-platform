import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { plainActionHandlers, validatePlainCredential } from "./runtime.ts";

const service = "plain";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, plainActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validatePlainCredential(input.apiKey, fetcher, signal);
  },
};
