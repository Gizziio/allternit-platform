import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { textcortexActionHandlers, validateTextcortexCredential } from "./runtime.ts";

const service = "textcortex";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, textcortexActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTextcortexCredential({
      apiKey: input.apiKey,
      fetcher,
      signal,
    });
  },
};
