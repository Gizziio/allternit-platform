import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { taggunActionHandlers, validateTaggunCredential } from "./runtime.ts";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors("taggun", taggunActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTaggunCredential,
};
