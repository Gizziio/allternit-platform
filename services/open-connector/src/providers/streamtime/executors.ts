import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { streamtimeActionHandlers, validateStreamtimeCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("streamtime", streamtimeActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateStreamtimeCredential(input.apiKey, fetcher, signal);
  },
};
