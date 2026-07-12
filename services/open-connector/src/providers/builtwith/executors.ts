import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { builtwithActionHandlers, validateBuiltwithCredential } from "./runtime.ts";

const service = "builtwith";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, builtwithActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBuiltwithCredential({ apiKey: input.apiKey, fetcher, signal });
  },
};
