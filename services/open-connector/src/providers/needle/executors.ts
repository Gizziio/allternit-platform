import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { needleActionHandlers, validateNeedleCredential } from "./runtime.ts";

const service = "needle";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, needleActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateNeedleCredential(input, fetcher, signal);
  },
};
