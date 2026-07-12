import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { systemeIoActionHandlers, validateSystemeIoCredential } from "./runtime.ts";

const service = "systeme_io";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, systemeIoActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateSystemeIoCredential(input, fetcher, signal);
  },
};
