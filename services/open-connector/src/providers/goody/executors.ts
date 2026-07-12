import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { goodyActionHandlers, validateGoodyCredential } from "./runtime.ts";

const service = "goody";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, goodyActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateGoodyCredential(input, fetcher, signal);
  },
};
