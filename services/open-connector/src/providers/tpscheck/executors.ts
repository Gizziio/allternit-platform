import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { tpscheckActionHandlers, validateTpscheckCredential } from "./runtime.ts";

const service = "tpscheck";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, tpscheckActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTpscheckCredential,
};
