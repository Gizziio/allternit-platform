import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { ripplingActionHandlers, validateRipplingCredential } from "./runtime.ts";

const service = "rippling";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, ripplingActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateRipplingCredential(input.apiKey, fetcher, signal);
  },
};
