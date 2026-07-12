import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { lexofficeActionHandlers, validateLexofficeCredential } from "./runtime.ts";

const service = "lexoffice";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, lexofficeActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateLexofficeCredential(input.apiKey, fetcher, signal);
  },
};
