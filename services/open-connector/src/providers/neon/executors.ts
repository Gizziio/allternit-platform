import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { neonActionHandlers, validateNeonCredential } from "./runtime.ts";

const service = "neon";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, neonActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateNeonCredential(input, fetcher, signal);
  },
};
