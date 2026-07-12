import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { metasoActionHandlers, validateMetasoCredential } from "./runtime.ts";

const service = "metaso";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, metasoActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMetasoCredential(input.apiKey, fetcher, signal);
  },
};
