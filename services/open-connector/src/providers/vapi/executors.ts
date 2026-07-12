import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateVapiCredential, vapiActionHandlers } from "./runtime.ts";

const service = "vapi";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, vapiActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateVapiCredential(input.apiKey, fetcher);
  },
};
