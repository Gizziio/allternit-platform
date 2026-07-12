import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { toriiActionHandlers, validateToriiCredential } from "./runtime.ts";

const service = "torii";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, toriiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateToriiCredential(input.apiKey, fetcher, signal);
  },
};
