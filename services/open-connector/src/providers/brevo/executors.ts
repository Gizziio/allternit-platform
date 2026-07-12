import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { brevoActionHandlers, validateBrevoCredential } from "./runtime.ts";

const service = "brevo";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, brevoActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBrevoCredential(input.apiKey, fetcher, signal);
  },
};
