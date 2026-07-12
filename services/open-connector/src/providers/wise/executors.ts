import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateWiseCredential, wiseActionHandlers } from "./runtime.ts";

const service = "wise";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, wiseActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateWiseCredential(input.apiKey, fetcher, signal);
  },
};
