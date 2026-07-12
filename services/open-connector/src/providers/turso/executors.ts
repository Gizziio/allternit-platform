import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { tursoActionHandlers, validateTursoCredential } from "./runtime.ts";

const service = "turso";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, tursoActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTursoCredential(input.apiKey, fetcher, signal);
  },
};
