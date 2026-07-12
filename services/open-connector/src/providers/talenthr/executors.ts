import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { talenthrActionHandlers, validateTalenthrCredential } from "./runtime.ts";

const service = "talenthr";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, talenthrActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey: validateTalenthrCredential,
};
