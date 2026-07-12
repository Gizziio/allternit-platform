import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { browserlessActionHandlers, validateBrowserlessCredential } from "./runtime.ts";

const service = "browserless";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, browserlessActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBrowserlessCredential(input.apiKey, fetcher, signal);
  },
};
