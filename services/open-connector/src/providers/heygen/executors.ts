import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { heygenActionHandlers, validateHeygenCredential } from "./runtime.ts";

const service = "heygen";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, heygenActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateHeygenCredential,
};
