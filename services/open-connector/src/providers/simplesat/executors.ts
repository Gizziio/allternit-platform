import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { simplesatActionHandlers, validateSimplesatCredential } from "./runtime.ts";

const service = "simplesat";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, simplesatActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateSimplesatCredential(input.apiKey, fetcher, signal);
  },
};
