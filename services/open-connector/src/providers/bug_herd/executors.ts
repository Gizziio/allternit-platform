import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { bugHerdActionHandlers, validateBugHerdCredential } from "./runtime.ts";

const service = "bug_herd";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, bugHerdActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBugHerdCredential(input.apiKey, fetcher, signal);
  },
};
