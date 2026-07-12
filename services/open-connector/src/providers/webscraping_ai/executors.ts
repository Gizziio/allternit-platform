import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateWebscrapingAiCredential, webscrapingAiActionHandlers } from "./runtime.ts";

const service = "webscraping_ai";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, webscrapingAiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateWebscrapingAiCredential(input.apiKey, fetcher, signal);
  },
};
