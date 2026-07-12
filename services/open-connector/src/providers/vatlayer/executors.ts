import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateVatlayerCredential, vatlayerActionHandlers } from "./runtime.ts";

const service = "vatlayer";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, vatlayerActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateVatlayerCredential(input.apiKey, fetcher);
  },
};
