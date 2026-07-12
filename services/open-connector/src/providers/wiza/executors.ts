import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateWizaCredential, wizaActionHandlers } from "./runtime.ts";

const service = "wiza";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, wizaActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateWizaCredential(input.apiKey, fetcher, signal);
  },
};
