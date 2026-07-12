import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { mailsSoActionHandlers, validateMailsSoCredential } from "./runtime.ts";

const service = "mails_so";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, mailsSoActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMailsSoCredential(input.apiKey, fetcher, signal);
  },
};
