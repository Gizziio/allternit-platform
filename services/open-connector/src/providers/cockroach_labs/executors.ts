import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { cockroachLabsActionHandlers, validateCockroachLabsApiKey } from "./runtime.ts";

const service = "cockroach_labs";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, cockroachLabsActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateCockroachLabsApiKey,
};
