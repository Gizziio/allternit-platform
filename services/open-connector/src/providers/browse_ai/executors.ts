import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { browseAiActionHandlers, validateBrowseAiCredential } from "./runtime.ts";

const service = "browse_ai";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, browseAiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBrowseAiCredential(input.apiKey, fetcher, signal);
  },
};
