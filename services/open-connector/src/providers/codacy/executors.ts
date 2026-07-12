import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { codacyActionHandlers, validateCodacyApiKey } from "./runtime.ts";

const service = "codacy";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, codacyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateCodacyApiKey,
};
