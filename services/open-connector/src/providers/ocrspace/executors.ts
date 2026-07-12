import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { ocrspaceActionHandlers, validateOcrspaceCredential } from "./runtime.ts";

const service = "ocrspace";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, ocrspaceActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateOcrspaceCredential(input.apiKey, fetcher, signal);
  },
};
