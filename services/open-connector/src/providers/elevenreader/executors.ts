import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { elevenreaderActionHandlers, validateElevenreaderCredential } from "./runtime.ts";

const service = "elevenreader";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, elevenreaderActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateElevenreaderCredential(input.apiKey, fetcher, signal);
  },
};
