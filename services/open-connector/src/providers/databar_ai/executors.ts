import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { databarAiActionHandlers, validateDatabarAiCredential } from "./runtime.ts";

const service = "databar_ai";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, databarAiActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateDatabarAiCredential(input.apiKey, fetcher, signal);
  },
};
