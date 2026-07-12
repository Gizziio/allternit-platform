import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { signalbaseActionHandlers, validateSignalbaseCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("signalbase", signalbaseActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }): ReturnType<typeof validateSignalbaseCredential> {
    return validateSignalbaseCredential({ ...input.values, apiKey: input.apiKey }, fetcher, signal);
  },
};
