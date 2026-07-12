import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { memberstackActionHandlers, validateMemberstackCredential } from "./runtime.ts";

const service = "memberstack";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, memberstackActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMemberstackCredential(input.apiKey, fetcher, signal);
  },
};
