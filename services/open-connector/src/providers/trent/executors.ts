import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { trentActionHandlers, validateTrentCredential } from "./runtime.ts";

const service = "trent";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, trentActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input): ReturnType<typeof validateTrentCredential> {
    return validateTrentCredential(input.apiKey);
  },
};
