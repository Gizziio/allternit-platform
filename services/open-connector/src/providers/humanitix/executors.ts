import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { humanitixActionHandlers, validateHumanitixCredential } from "./runtime.ts";

const service = "humanitix";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, humanitixActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateHumanitixCredential,
};
