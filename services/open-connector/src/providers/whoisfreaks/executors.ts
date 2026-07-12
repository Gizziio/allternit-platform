import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateWhoisfreaksCredential, whoisfreaksActionHandlers } from "./runtime.ts";

const service = "whoisfreaks";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, whoisfreaksActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateWhoisfreaksCredential(input.apiKey, fetcher, signal);
  },
};
