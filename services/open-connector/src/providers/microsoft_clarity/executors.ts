import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { microsoftClarityActionHandlers, validateMicrosoftClarityCredential } from "./runtime.ts";

const service = "microsoft_clarity";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, microsoftClarityActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMicrosoftClarityCredential(input.apiKey, fetcher, signal);
  },
};
