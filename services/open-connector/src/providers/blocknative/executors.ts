import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { blocknativeActionHandlers, validateBlocknativeCredential } from "./runtime.ts";

const service = "blocknative";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, blocknativeActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateBlocknativeCredential(input.apiKey, fetcher, signal);
  },
};
