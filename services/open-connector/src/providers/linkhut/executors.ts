import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineOAuthProviderExecutors } from "../provider-runtime.ts";
import { linkhutActionHandlers, validateLinkhutCredential } from "./runtime.ts";

const service = "linkhut";

export const executors: ProviderExecutors = defineOAuthProviderExecutors(service, linkhutActionHandlers);

export const credentialValidators: CredentialValidators = {
  oauth2(input, { fetcher, signal }) {
    return validateLinkhutCredential(input, fetcher, signal);
  },
};
