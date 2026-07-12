import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { googleAddressValidationActionHandlers, validateGoogleAddressValidationCredential } from "./runtime.ts";

const service = "google_address_validation";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(
  service,
  googleAddressValidationActionHandlers,
);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateGoogleAddressValidationCredential(input, fetcher, signal);
  },
};
