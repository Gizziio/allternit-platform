import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { heyzineActionHandlers, validateHeyzineCredential } from "./runtime.ts";

const service = "heyzine";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, heyzineActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateHeyzineCredential,
};
