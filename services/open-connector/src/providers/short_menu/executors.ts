import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { shortMenuActionHandlers, validateShortMenuCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("short_menu", shortMenuActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }): ReturnType<typeof validateShortMenuCredential> {
    return validateShortMenuCredential({ ...input.values, apiKey: input.apiKey }, fetcher);
  },
};
