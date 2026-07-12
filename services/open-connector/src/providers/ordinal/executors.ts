import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { ordinalActionHandlers, validateOrdinalCredential } from "./runtime.ts";

const service = "ordinal";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, ordinalActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateOrdinalCredential(input.apiKey, fetcher, signal);
  },
};
