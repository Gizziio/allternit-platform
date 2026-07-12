import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { globalpingActionHandlers, validateGlobalpingCredential } from "./runtime.ts";

const service = "globalping";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, globalpingActionHandlers);

export const credentialValidators: CredentialValidators = {
  async apiKey(input, { fetcher, signal }) {
    return validateGlobalpingCredential(input, fetcher, signal);
  },
};
