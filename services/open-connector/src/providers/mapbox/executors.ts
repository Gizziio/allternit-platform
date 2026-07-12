import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { mapboxActionHandlers, validateMapboxCredential } from "./runtime.ts";

const service = "mapbox";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, mapboxActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateMapboxCredential(input.apiKey, fetcher, signal);
  },
};
