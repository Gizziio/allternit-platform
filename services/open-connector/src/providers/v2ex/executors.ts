import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { v2exActionHandlers, validateV2exCredential } from "./runtime.ts";

const service = "v2ex";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, v2exActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateV2exCredential(input.apiKey, fetcher);
  },
};
