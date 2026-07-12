import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { sitespeakaiActionHandlers, validateSitespeakaiCredential } from "./runtime.ts";

const service = "sitespeakai";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, sitespeakaiActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSitespeakaiCredential(input.apiKey, fetcher, signal);
  },
};
