import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { surecontactActionHandlers, validateSureContactCredential } from "./runtime.ts";

const service = "surecontact";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, surecontactActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateSureContactCredential(input.apiKey, fetcher, signal);
  },
};
