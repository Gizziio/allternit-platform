import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateWitAiCredential, witAiActionHandlers } from "./runtime.ts";

const service = "wit_ai";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, witAiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateWitAiCredential(input.apiKey, fetcher, signal);
  },
};
