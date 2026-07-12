import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { validateVectorshiftCredential, vectorshiftActionHandlers } from "./runtime.ts";

const service = "vectorshift";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, vectorshiftActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher }) {
    return validateVectorshiftCredential(input.apiKey, fetcher);
  },
};
