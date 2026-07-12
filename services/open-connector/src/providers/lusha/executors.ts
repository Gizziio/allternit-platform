import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { lushaActionHandlers, validateLushaCredential } from "./runtime.ts";

const service = "lusha";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, lushaActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateLushaCredential(input.apiKey, fetcher, signal);
  },
};
