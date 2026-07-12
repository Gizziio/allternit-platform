import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { googleRoutesActionHandlers, validateGoogleRoutesCredential } from "./runtime.ts";

const service = "google_routes";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, googleRoutesActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateGoogleRoutesCredential(input, fetcher, signal);
  },
};
