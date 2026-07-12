import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { northflankActionHandlers, validateNorthflankCredential } from "./runtime.ts";

const service = "northflank";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, northflankActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateNorthflankCredential(input.apiKey, fetcher, signal);
  },
};
