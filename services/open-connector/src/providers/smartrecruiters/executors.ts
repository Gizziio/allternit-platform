import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { smartrecruitersActionHandlers, validateSmartRecruitersCredential } from "./runtime.ts";

const service = "smartrecruiters";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, smartrecruitersActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateSmartRecruitersCredential(input.apiKey, fetcher, signal);
  },
};
