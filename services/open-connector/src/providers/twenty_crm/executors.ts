import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { twentyCrmActionHandlers, validateTwentyCrmCredential } from "./runtime.ts";

const service = "twenty_crm";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, twentyCrmActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTwentyCrmCredential(input.apiKey, fetcher, signal);
  },
};
