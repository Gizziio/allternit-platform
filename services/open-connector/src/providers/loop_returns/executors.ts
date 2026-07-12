import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { loopReturnsActionHandlers, validateLoopReturnsCredential } from "./runtime.ts";

const service = "loop_returns";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, loopReturnsActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateLoopReturnsCredential(input.apiKey, fetcher, signal);
  },
};
