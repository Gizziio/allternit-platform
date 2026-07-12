import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { mineruActionHandlers, validateMineruCredential } from "./runtime.ts";

const service = "mineru";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, mineruActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMineruCredential(input.apiKey, fetcher, signal);
  },
};
