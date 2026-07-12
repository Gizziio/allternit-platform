import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { theDogApiActionHandlers, validateTheDogApiCredential } from "./runtime.ts";

const service = "the_dog_api";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, theDogApiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTheDogApiCredential,
};
