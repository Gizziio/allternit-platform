import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { mezmoActionHandlers, validateMezmoCredential } from "./runtime.ts";

const service = "mezmo";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, mezmoActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMezmoCredential(input.apiKey, fetcher, signal);
  },
};
