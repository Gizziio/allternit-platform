import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { gtmetrixActionHandlers, validateGtmetrixCredential } from "./runtime.ts";

const service = "gtmetrix";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, gtmetrixActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateGtmetrixCredential(input.apiKey, fetcher, signal);
  },
};
