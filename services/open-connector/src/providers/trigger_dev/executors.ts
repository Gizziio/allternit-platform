import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { triggerDevActionHandlers, validateTriggerDevCredential } from "./runtime.ts";

const service = "trigger_dev";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, triggerDevActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTriggerDevCredential(input.apiKey, fetcher, signal);
  },
};
