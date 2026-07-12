import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { umamiActionHandlers, validateUmamiCredential } from "./runtime.ts";

const service = "umami";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, umamiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateUmamiCredential(input.apiKey, fetcher, signal);
  },
};
