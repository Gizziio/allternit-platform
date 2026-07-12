import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { mailersendActionHandlers, validateMailersendCredential } from "./runtime.ts";

const service = "mailersend";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, mailersendActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMailersendCredential(input.apiKey, fetcher, signal);
  },
};
