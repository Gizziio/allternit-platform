import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { mailblusterActionHandlers, validateMailblusterCredential } from "./runtime.ts";

const service = "mailbluster";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, mailblusterActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateMailblusterCredential(input.apiKey, fetcher, signal);
  },
};
