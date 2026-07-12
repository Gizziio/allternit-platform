import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { holdedActionHandlers, validateHoldedCredential } from "./runtime.ts";

const service = "holded";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, holdedActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateHoldedCredential,
};
