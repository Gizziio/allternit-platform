import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { accuweatherActionHandlers, validateAccuweatherCredential } from "./runtime.ts";

const service = "accuweather";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, accuweatherActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateAccuweatherCredential(input.apiKey, fetcher, signal);
  },
};
