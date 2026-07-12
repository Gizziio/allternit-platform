import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { twitterapiIoActionHandlers, validateTwitterApiIoCredential } from "./runtime.ts";

const service = "twitterapi_io";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, twitterapiIoActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateTwitterApiIoCredential(input.apiKey, fetcher, signal);
  },
};
