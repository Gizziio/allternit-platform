import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { emailListVerifyActionHandlers, validateEmailListVerifyCredential } from "./runtime.ts";

const service = "emaillistverify";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, emailListVerifyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateEmailListVerifyCredential(input.apiKey, fetcher, signal);
  },
};
