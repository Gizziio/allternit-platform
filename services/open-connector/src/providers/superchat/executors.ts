import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { superchatActionHandlers, validateSuperchatCredential } from "./runtime.ts";

const service = "superchat";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, superchatActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateSuperchatCredential(input, fetcher, signal);
  },
};
