import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { databoxActionHandlers, validateDataboxCredential } from "./runtime.ts";

const service = "databox";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, databoxActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateDataboxCredential(input.apiKey, fetcher, signal);
  },
};
