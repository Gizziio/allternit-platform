import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineOAuthProviderExecutors } from "../provider-runtime.ts";
import { calActionHandlers, validateCalCredential } from "./runtime.ts";

const service = "cal";

export const executors: ProviderExecutors = defineOAuthProviderExecutors(service, calActionHandlers);

export const credentialValidators: CredentialValidators = {
  oauth2(input, { fetcher, signal }) {
    return validateCalCredential(input, fetcher, signal);
  },
};
