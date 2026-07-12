import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { optimorouteActionHandlers, validateOptimorouteCredential } from "./runtime.ts";

const service = "optimoroute";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, optimorouteActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateOptimorouteCredential(input.apiKey, fetcher, signal);
  },
};
