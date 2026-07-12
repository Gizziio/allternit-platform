import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { textitActionHandlers, validateTextitApiKey } from "./runtime.ts";

const service = "textit";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, textitActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTextitApiKey({
      apiKey: input.apiKey,
      fetcher,
      signal,
    });
  },
};
