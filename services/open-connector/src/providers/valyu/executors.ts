import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { valyuActionHandlers, validateValyuCredential } from "./runtime.ts";

const service = "valyu";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, valyuActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateValyuCredential(input.apiKey, fetcher);
  },
};
