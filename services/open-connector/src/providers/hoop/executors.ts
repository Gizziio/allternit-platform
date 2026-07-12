import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { hoopActionHandlers, validateHoopCredential } from "./runtime.ts";

const service = "hoop";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, hoopActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateHoopCredential,
};
