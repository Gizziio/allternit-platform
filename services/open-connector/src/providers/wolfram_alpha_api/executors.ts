import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateWolframAlphaApiCredential, wolframAlphaApiActionHandlers } from "./runtime.ts";

const service = "wolfram_alpha_api";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, wolframAlphaApiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateWolframAlphaApiCredential(input.apiKey, fetcher, signal);
  },
};
