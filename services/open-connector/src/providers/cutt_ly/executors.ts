import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { cuttLyActionHandlers, validateCuttlyCredential } from "./runtime.ts";

const service = "cutt_ly";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, cuttLyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateCuttlyCredential(input.apiKey, fetcher, signal);
  },
};
