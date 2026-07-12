import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { tinyurlActionHandlers, validateTinyurlCredential } from "./runtime.ts";

const service = "tinyurl";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, tinyurlActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateTinyurlCredential(input.apiKey, fetcher, signal);
  },
};
