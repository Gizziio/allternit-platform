import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { twochatActionHandlers, validateTwochatCredential } from "./runtime.ts";

const service = "twochat";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, twochatActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTwochatCredential(input.apiKey, fetcher, signal);
  },
};
