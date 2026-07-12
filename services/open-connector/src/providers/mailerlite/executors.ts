import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { mailerliteActionHandlers, validateMailerliteCredential } from "./runtime.ts";

const service = "mailerlite";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, mailerliteActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMailerliteCredential(input.apiKey, fetcher, signal);
  },
};
