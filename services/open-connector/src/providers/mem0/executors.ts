import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { mem0ActionHandlers, validateMem0ApiKey } from "./runtime.ts";

const service = "mem0";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, mem0ActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMem0ApiKey(input.apiKey, fetcher, signal);
  },
};
