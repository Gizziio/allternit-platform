import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { tikhubActionHandlers, validateTikHubCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("tikhub", tikhubActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }): ReturnType<typeof validateTikHubCredential> {
    return validateTikHubCredential({ ...input.values, apiKey: input.apiKey }, fetcher);
  },
};
