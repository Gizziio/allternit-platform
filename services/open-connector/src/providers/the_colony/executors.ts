import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { theColonyActionHandlers, validateTheColonyCredential } from "./runtime.ts";

const service = "the_colony";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, theColonyActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTheColonyCredential(input.apiKey, fetcher, signal);
  },
};
