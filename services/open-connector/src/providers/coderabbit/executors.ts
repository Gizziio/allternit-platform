import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { coderabbitActionHandlers, validateCoderabbitApiKey } from "./runtime.ts";

const service = "coderabbit";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, coderabbitActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateCoderabbitApiKey,
};
