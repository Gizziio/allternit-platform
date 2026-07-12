import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { similarwebDigitalRankApiActionHandlers, validateSimilarwebDigitalRankApiCredential } from "./runtime.ts";

const service = "similarweb_digitalrank_api";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(
  service,
  similarwebDigitalRankApiActionHandlers,
);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSimilarwebDigitalRankApiCredential(input.apiKey, fetcher, signal);
  },
};
