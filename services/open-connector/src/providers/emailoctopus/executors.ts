import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { emailoctopusActionHandlers, validateEmailoctopusCredential } from "./runtime.ts";

const service = "emailoctopus";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, emailoctopusActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateEmailoctopusCredential(input.apiKey, fetcher, signal);
  },
};
