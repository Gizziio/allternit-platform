import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { manusActionHandlers, validateManusCredential } from "./runtime.ts";

const service = "manus";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, manusActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateManusCredential(input.apiKey, fetcher, signal);
  },
};
