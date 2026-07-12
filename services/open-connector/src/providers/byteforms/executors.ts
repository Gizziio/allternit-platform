import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { byteformsActionHandlers, validateByteformsCredential } from "./runtime.ts";

const service = "byteforms";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, byteformsActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateByteformsCredential(input.apiKey, fetcher, signal);
  },
};
