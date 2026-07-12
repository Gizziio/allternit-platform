import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { hyperbrowserActionHandlers, validateHyperbrowserCredential } from "./runtime.ts";

const service = "hyperbrowser";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, hyperbrowserActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateHyperbrowserCredential,
};
