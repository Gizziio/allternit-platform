import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { godialActionHandlers, validateGodialCredential } from "./runtime.ts";

const service = "godial";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, godialActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateGodialCredential(input, fetcher, signal);
  },
};
