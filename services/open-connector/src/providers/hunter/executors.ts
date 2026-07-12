import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { hunterActionHandlers, validateHunterCredential } from "./runtime.ts";

const service = "hunter";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, hunterActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateHunterCredential,
};
