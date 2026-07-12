import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { leadfeederActionHandlers, validateLeadfeederCredential } from "./runtime.ts";

const service = "leadfeeder";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, leadfeederActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateLeadfeederCredential(input.apiKey, fetcher, signal);
  },
};
