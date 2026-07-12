import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { owlProtocolActionHandlers, validateOwlProtocolCredential } from "./runtime.ts";

const service = "owl_protocol";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, owlProtocolActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateOwlProtocolCredential(input.apiKey, fetcher, signal);
  },
};
