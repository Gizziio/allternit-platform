import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { currencyscoopActionHandlers, validateCurrencyscoopCredential } from "./runtime.ts";

const service = "currencyscoop";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, currencyscoopActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateCurrencyscoopCredential(input.apiKey, fetcher, signal);
  },
};
