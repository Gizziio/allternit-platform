import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { dovetailActionHandlers, validateDovetailCredential } from "./runtime.ts";

const service = "dovetail";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, dovetailActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateDovetailCredential(input.apiKey, fetcher, signal);
  },
};
