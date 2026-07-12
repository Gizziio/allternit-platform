import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateYnabCredential, ynabActionHandlers } from "./runtime.ts";

const service = "ynab";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, ynabActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateYnabCredential(input.apiKey, fetcher, signal);
  },
};
