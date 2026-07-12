import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { typefullyActionHandlers, validateTypefullyCredential } from "./runtime.ts";

const service = "typefully";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, typefullyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTypefullyCredential(input.apiKey, fetcher, signal);
  },
};
