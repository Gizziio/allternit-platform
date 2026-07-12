import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { elorusExecutors, validateElorusCredential } from "./runtime.ts";

export const executors: ProviderExecutors = elorusExecutors;

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateElorusCredential(input, fetcher, signal);
  },
};
