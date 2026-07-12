import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { codaActionHandlers, validateCodaApiKey } from "./runtime.ts";

const service = "coda";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, codaActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateCodaApiKey,
};
