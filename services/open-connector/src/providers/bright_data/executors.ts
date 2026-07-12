import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { brightDataActionHandlers, validateBrightDataCredential } from "./runtime.ts";

const service = "bright_data";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, brightDataActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBrightDataCredential(input.apiKey, fetcher, signal);
  },
};
