import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateYouCredential, youActionHandlers } from "./runtime.ts";

const service = "you";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, youActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateYouCredential(input.apiKey, fetcher, signal);
  },
};
