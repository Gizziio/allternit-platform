import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { taveActionHandlers, validateTaveCredential } from "./runtime.ts";

const service = "tave";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, taveActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTaveCredential,
};
