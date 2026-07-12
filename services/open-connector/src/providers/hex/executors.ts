import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { hexActionHandlers, validateHexCredential } from "./runtime.ts";

const service = "hex";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, hexActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateHexCredential,
};
