import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { mediastackActionHandlers, validateMediastackCredential } from "./runtime.ts";

const service = "mediastack";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, mediastackActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateMediastackCredential,
};
