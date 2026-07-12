import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { executors as heyyExecutors, validateHeyyCredential } from "./runtime.ts";

export const executors: ProviderExecutors = heyyExecutors;

export const credentialValidators: CredentialValidators = {
  apiKey: validateHeyyCredential,
};
