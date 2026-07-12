import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { rawgActionHandlers, validateRawgCredential } from "./runtime.ts";

const service = "rawg";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, rawgActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateRawgCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
