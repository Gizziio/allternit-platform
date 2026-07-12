import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { tallyActionHandlers, validateTallyCredential } from "./runtime.ts";

const service = "tally";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, tallyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTallyCredential,
};
