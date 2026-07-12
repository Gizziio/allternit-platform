import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { blandAiActionHandlers, validateBlandAiCredential } from "./runtime.ts";

const service = "bland_ai";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, blandAiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBlandAiCredential(input.apiKey, fetcher, signal);
  },
};
