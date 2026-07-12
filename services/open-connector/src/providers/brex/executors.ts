import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { brexActionHandlers, validateBrexCredential } from "./runtime.ts";

const service = "brex";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, brexActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBrexCredential(input.apiKey, fetcher, signal);
  },
};
