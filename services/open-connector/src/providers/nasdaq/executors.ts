import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { nasdaqActionHandlers, validateNasdaqCredential } from "./runtime.ts";

const service = "nasdaq";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, nasdaqActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateNasdaqCredential(input, fetcher, signal);
  },
};
