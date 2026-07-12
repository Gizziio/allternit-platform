import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { censusBureauActionHandlers, validateCensusBureauCredential } from "./runtime.ts";

const service = "census_bureau";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, censusBureauActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateCensusBureauCredential,
};
