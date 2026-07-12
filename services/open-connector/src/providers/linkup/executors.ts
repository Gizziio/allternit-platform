import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { linkupActionHandlers, validateLinkupCredential } from "./runtime.ts";

const service = "linkup";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, linkupActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateLinkupCredential(input.apiKey, fetcher, signal);
  },
};
