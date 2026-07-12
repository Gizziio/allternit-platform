import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { placidActionHandlers, validatePlacidCredential } from "./runtime.ts";

const service = "placid";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, placidActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validatePlacidCredential(input.apiKey, fetcher, signal);
  },
};
