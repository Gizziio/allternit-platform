import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateWrikeCredential, wrikeActionHandlers } from "./runtime.ts";

const service = "wrike";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, wrikeActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateWrikeCredential(input.apiKey, fetcher, signal);
  },
};
