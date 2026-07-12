import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { theirstackActionHandlers, validateTheirStackCredential } from "./runtime.ts";

const service = "theirstack";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, theirstackActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTheirStackCredential,
};
