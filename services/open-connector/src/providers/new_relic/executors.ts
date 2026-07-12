import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { newRelicActionHandlers, validateNewRelicCredential } from "./runtime.ts";

const service = "new_relic";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, newRelicActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher }) {
    return validateNewRelicCredential(input.apiKey, fetcher);
  },
};
