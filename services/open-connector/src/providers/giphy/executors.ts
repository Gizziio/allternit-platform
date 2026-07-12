import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { giphyActionHandlers, validateGiphyCredential } from "./runtime.ts";

const service = "giphy";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, giphyActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateGiphyCredential(input, fetcher, signal);
  },
};
