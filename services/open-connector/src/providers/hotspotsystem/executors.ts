import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { hotspotsystemActionHandlers, validateHotspotsystemCredential } from "./runtime.ts";

const service = "hotspotsystem";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, hotspotsystemActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateHotspotsystemCredential,
};
