import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { bugbugActionHandlers, validateBugbugCredential } from "./runtime.ts";

const service = "bugbug";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, bugbugActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBugbugCredential(input.apiKey, fetcher, signal);
  },
};
