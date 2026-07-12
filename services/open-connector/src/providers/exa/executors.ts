import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { exaActionHandlers, validateExaApiKey } from "./runtime.ts";

const service = "exa";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, exaActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateExaApiKey(input.apiKey, fetcher, signal);
  },
};
