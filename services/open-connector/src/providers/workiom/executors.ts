import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateWorkiomCredential, workiomActionHandlers } from "./runtime.ts";

const service = "workiom";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, workiomActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateWorkiomCredential(input.apiKey, fetcher, signal);
  },
};
