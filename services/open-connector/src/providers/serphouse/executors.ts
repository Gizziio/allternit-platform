import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { serphouseActionHandlers, validateSerphouseCredential } from "./runtime.ts";

const service = "serphouse";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, serphouseActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateSerphouseCredential(input.apiKey, fetcher, signal);
  },
};
