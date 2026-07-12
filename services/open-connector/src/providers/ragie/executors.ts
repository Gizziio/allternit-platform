import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { ragieActionHandlers, validateRagieCredential } from "./runtime.ts";

const service = "ragie";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, ragieActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateRagieCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
