import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { shortpixelActionHandlers, validateShortpixelCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("shortpixel", shortpixelActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }): ReturnType<typeof validateShortpixelCredential> {
    return validateShortpixelCredential({ ...input.values, apiKey: input.apiKey }, fetcher);
  },
};
