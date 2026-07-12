import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { smartsheetActionHandlers, validateSmartsheetCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("smartsheet", smartsheetActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSmartsheetCredential(input.apiKey, fetcher, signal);
  },
};
