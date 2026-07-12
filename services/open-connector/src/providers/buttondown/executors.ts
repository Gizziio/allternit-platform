import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { buttondownActionHandlers, validateButtondownCredential } from "./runtime.ts";

const service = "buttondown";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, buttondownActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateButtondownCredential(input.apiKey, fetcher, signal);
  },
};
