import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { everhourActionHandlers, validateEverhourCredential } from "./runtime.ts";

const service = "everhour";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, everhourActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateEverhourCredential(input.apiKey, fetcher, signal);
  },
};
