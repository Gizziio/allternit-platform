import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { marketstackActionHandlers, validateMarketstackCredential } from "./runtime.ts";

const service = "marketstack";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, marketstackActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateMarketstackCredential,
};
