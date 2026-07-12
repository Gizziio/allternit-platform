import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { statistaActionHandlers, validateStatistaCredential } from "./runtime.ts";

const service = "statista";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, statistaActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateStatistaCredential(input.apiKey, fetcher, signal);
  },
};
