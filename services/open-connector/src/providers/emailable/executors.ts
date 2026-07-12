import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { emailableActionHandlers, validateEmailableCredential } from "./runtime.ts";

const service = "emailable";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, emailableActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateEmailableCredential(input.apiKey, fetcher, signal);
  },
};
