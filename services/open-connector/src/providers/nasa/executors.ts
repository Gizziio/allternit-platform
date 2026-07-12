import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { nasaActionHandlers, validateNasaCredential } from "./runtime.ts";

const service = "nasa";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, nasaActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateNasaCredential(input, fetcher, signal);
  },
};
