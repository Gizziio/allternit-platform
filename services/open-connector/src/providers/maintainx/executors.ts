import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { maintainxActionHandlers, validateMaintainxCredential } from "./runtime.ts";

const service = "maintainx";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, maintainxActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateMaintainxCredential(input.apiKey, fetcher, signal);
  },
};
