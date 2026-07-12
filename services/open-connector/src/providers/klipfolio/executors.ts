import type { CredentialValidators, ProviderExecutors } from "../../core/types.ts";

import { defineApiKeyProviderExecutors } from "../provider-runtime.ts";
import { klipfolioActionHandlers, validateKlipfolioCredential } from "./runtime.ts";

const service = "klipfolio";

export const executors: ProviderExecutors = defineApiKeyProviderExecutors(service, klipfolioActionHandlers);

export const credentialValidators: CredentialValidators = {
  apiKey(input, { fetcher, signal }) {
    return validateKlipfolioCredential({ apiKey: input.apiKey }, fetcher, signal);
  },
};
