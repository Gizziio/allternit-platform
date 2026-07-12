import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { datascopeActionHandlers, validateDatascopeCredential } from "./runtime.ts";

const service = "datascope";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, datascopeActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher }) {
    return validateDatascopeCredential({ apiKey: input.apiKey }, fetcher);
  },
};
