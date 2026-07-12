import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { taxjarActionHandlers, validateTaxjarCredential } from "./runtime.ts";

const service = "taxjar";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, taxjarActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTaxjarCredential,
};
