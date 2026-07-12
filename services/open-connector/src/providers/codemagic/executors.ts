import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { codemagicActionHandlers, validateCodemagicApiKey } from "./runtime.ts";

const service = "codemagic";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, codemagicActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateCodemagicApiKey,
};
