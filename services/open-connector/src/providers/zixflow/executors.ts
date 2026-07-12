import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateZixflowCredential, zixflowActionHandlers } from "./runtime.ts";

const service = "zixflow";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, zixflowActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateZixflowCredential(input.apiKey, fetcher, signal);
  },
};
