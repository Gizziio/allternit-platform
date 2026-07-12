import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { granolaActionHandlers, validateGranolaCredential } from "./runtime.ts";

const service = "granola";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, granolaActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateGranolaCredential(input.apiKey, fetcher, signal);
  },
};
