import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateZerobounceCredential, zerobounceActionHandlers } from "./runtime.ts";

const service = "zerobounce";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, zerobounceActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateZerobounceCredential(input.apiKey, fetcher, signal);
  },
};
