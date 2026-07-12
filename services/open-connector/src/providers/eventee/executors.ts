import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { eventeeActionHandlers, validateEventeeCredential } from "./runtime.ts";

const service = "eventee";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, eventeeActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateEventeeCredential(input.apiKey, fetcher, signal);
  },
};
