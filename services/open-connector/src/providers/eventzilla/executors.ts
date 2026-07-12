import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { eventzillaActionHandlers, validateEventzillaCredential } from "./runtime.ts";

const service = "eventzilla";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, eventzillaActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateEventzillaCredential(input.apiKey, fetcher, signal);
  },
};
