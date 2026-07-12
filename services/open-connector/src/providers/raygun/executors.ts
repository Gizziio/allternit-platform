import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { raygunActionHandlers, validateRaygunCredential } from "./runtime.ts";

const service = "raygun";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, raygunActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateRaygunCredential({ apiKey: input.apiKey, ...input.values }, fetcher);
  },
};
